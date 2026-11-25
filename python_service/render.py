"""Render the static-design service's drawings, proposals and business records."""
from __future__ import annotations

import base64
from copy import deepcopy
from hashlib import sha256
import html
from importlib.metadata import version as library_version
from io import BytesIO, StringIO
import json
from math import ceil
from pathlib import Path
import re
import subprocess
from xml.etree import ElementTree as ET
from zipfile import ZipFile, ZIP_DEFLATED, ZIP_STORED

import ezdxf
from ezdxf.enums import TextEntityAlignment
from jinja2 import Environment, FileSystemLoader, StrictUndefined
import xlsxwriter


ROOT = Path(__file__).resolve().parent
TEMPLATES = Environment(loader=FileSystemLoader(ROOT / "templates"), undefined=StrictUndefined, autoescape=False)


def _markdown(value):
    text = html.escape(" ".join(str(value or "").split()), quote=False)
    return re.sub(r"([\\\[\]()*_`#!|])", r"\\\1", text)


TEMPLATES.filters["md"] = _markdown
XML_CONTROL = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\ud800-\udfff\ufffe\uffff]")
TEXT_FILES = {
    "01-定制资源分类清单.csv", "02-定制需求结构化参数清单.csv", "03-客户情绪审美标签报告.md",
    "05-资源匹配适配说明与方案可行性提示.md", "07-定制视觉效果需求包.md",
    "视觉预览/01-成衣正背面.svg", "视觉预览/02-工艺与材质特写.svg", "视觉预览/03-上身与场景氛围.svg",
}
PHOTO_NAMES = {"garment":"01-成衣正背面.jpg", "detail":"02-工艺与材质特写.jpg", "on-body":"03-上身与场景氛围.jpg"}


def design_text(solution, brief):
    s, b = deepcopy(solution), deepcopy(brief)
    fields = {f["key"]: f for f in s.get("requirements", [])}
    assets = {a["type"]: a for a in s.get("assets", [])}
    p = b["parameters"]
    order = ["headcount", "wearers", "activity", "replenishment", "bodyDescription"] if s["scene"] == "group" else ["activity", "bodyDescription"]
    context = [fields[k] for k in order if fields.get(k, {}).get("value") and fields[k].get("level") != "unspecified"]
    if all(t in assets for t in ("pattern", "fabric", "craft")):
        s["summary"] = " × ".join(assets[t]["name"] for t in ("pattern", "fabric", "craft"))
        for section in s["sections"]:
            section["body"] = TEMPLATES.get_template("section.j2").render(
                title=section["title"], previous=section["body"], s=s, assets=assets,
                fit=p["dimensions"].get("requested", []), context_fields=context,
                get=lambda key: fields.get(key, {}).get("value", ""),
            )
    colour = p["color"]
    if colour["status"] == "pending":
        colour_text = "主色待确认，沟通图以" + colour["value"] + "示意"
        if colour.get("request"):
            colour_text += "，待核对的原色要求为「" + colour["request"] + "」"
    else:
        colour_text = "主色为" + colour["value"] + ("" if colour.get("catalogEvidence") else "，实物色卡待确认")
        if len(colour.get("options", [])) > 1:
            colour_text += "，仅呈现这一候选色，备选色另行沟通"
    names = {k:(a or {}).get("name","") for k,a in p["assets"].items()}
    def phrase(*items):
        return "，".join(str(x) for x in items if x)
    motif = "纹样或地域偏好「" + p["designDetail"] + "」，样布及具体设计待确认" if p.get("designDetail") else ""
    garment = phrase(names.get("pattern"), names.get("fabric"), names.get("craft"), p["collar"], p["closure"], p["silhouette"])
    construction = phrase(f"V{b['version']} 同版服装", names.get("pattern"), p["collar"], names.get("fabric"), names.get("craft"),
                          p["closure"], colour_text, ("风格为"+p["style"]) if p["style"] else "", motif)
    for item in b["prompts"]:
        if not item.get("guidance"):
            # Older stored prompt snapshots remain readable with their original wording.
            continue
        scene_text = ""
        if item["key"] == "on-body":
            scene_text = phrase(("场景为" + p["environment"]) if p.get("environment") else "中性穿着场景，避免虚构具体地点",
                                ("穿着人群为" + p["wearers"]) if p.get("wearers") else "",
                                ("动作参照" + p["activity"]) if p.get("activity") else "自然站立")
        template = TEMPLATES.get_template("visual-prompt.j2")
        context = dict(item=item, p=p, garment=garment, construction=construction, colour_text=colour_text, scene_text=scene_text, motif=motif)
        item["text"] = template.render(**context, positive=False)
        item["profiles"]["positive"] = template.render(**context, positive=True)
        item["profiles"]["negative"] = "，".join(item["avoid"])
        item["profiles"]["midjourney"] = item["text"] + " --ar " + item["ratio"]
    return s, b


def svg_drawing(model):
    root = ET.Element("svg", {"xmlns":"http://www.w3.org/2000/svg", "role":"img",
        "viewBox":f"0 0 {model['width']} {model['height']}", "aria-label":"模拟款式技术图，含六项毫米测点",
        "font-family":"system-ui, Arial, Microsoft YaHei, sans-serif"})
    def element(tag, **attrs):
        return ET.SubElement(root, tag, {k.replace("_", "-"):str(v) for k,v in attrs.items()})
    element("title").text = "模拟款式技术图"
    element("desc").text = f"正视图、背视图、六项毫米尺寸和校尺。方案版本 V{model['revision']}。"
    element("rect", width=model["width"], height=model["height"], rx=14, fill="#fcfdfb")
    element("path", d="M50 164H2050M1790 194V1075", stroke="#dce5e4", stroke_width=2)
    element("rect", x=1812, y=291, width=235, height=272, rx=13, fill="#f0f6f5", stroke="#d6e6e2", stroke_width=2)
    element("path", d="M1832 464H2028", stroke="#b1c9c1", stroke_width=2, stroke_dasharray="8 7")
    for item in model["entities"] + model["dimensionGraphics"]:
        style = model["layers"][item["layer"]]
        attrs = dict(stroke=style["ink"], stroke_width=style["width"], fill="none", stroke_linejoin="round", stroke_linecap="round")
        if style.get("dash"):
            attrs["stroke_dasharray"] = style["dash"]
        if item["type"] == "line":
            a,b = item["from"],item["to"]
            element("line",x1=a[0],y1=a[1],x2=b[0],y2=b[1],**attrs)
        elif item["type"] == "path":
            element("polygon" if item["closed"] else "polyline",points=" ".join(f"{x},{y}" for x,y in item["points"]),**attrs)
        else:
            x,y = item["position"]
            element("text",x=x,y=y,fill=style["ink"],font_size=item["size"],font_weight=600 if item.get("bold") else 400,
                    text_anchor=item.get("anchor","start")).text = XML_CONTROL.sub("", item["svgText"])
    points = [d[k] for d in model["dimensions"] for k in ("from","to")] + model["frontPlacket"]
    for x,y in points:
        element("circle",cx=x,cy=y,r=5,fill="#fcfdfb",stroke="#006b64",stroke_width=2)
    return ET.tostring(root, encoding="unicode")


def dxf_drawing(model):
    doc = ezdxf.new("R2013")
    doc.units = ezdxf.units.MM
    doc.header["$MEASUREMENT"] = 1
    doc.header["$LUPREC"] = 2
    doc.linetypes.add("DASHED", pattern=[14,8,-6], description="Craft construction")
    for name,layer in model["layers"].items():
        doc.layers.add(name, color=layer["color"], linetype="DASHED" if layer.get("dash") else "Continuous")
    ms = doc.modelspace()
    def xy(point):
        return point[0], -point[1]
    for item in model["entities"]:
        attrs = {"layer":item["layer"]}
        if item["type"] == "line":
            ms.add_line(xy(item["from"]),xy(item["to"]),dxfattribs=attrs)
        elif item["type"] == "path":
            ms.add_lwpolyline([xy(p) for p in item["points"]], format="xy", close=item["closed"], dxfattribs=attrs)
        else:
            text = ms.add_text(item["cadText"],height=item["size"],dxfattribs=attrs)
            alignment = TextEntityAlignment.CENTER if item.get("anchor") == "middle" else TextEntityAlignment.LEFT
            text.set_placement(xy(item["position"]),align=alignment)
    for d in model["dimensions"]:
        a,b = xy(d["from"]),xy(d["to"])
        attrs = dict(p1=a,p2=b,text=d["mark"]+" <>",dimstyle="Standard",dxfattribs={"layer":"DIMENSIONS"},
                     override={"dimtxt":17,"dimasz":4,"dimdec":2,"dimexe":5,"dimgap":3})
        if d["axis"] == "aligned":
            dim = ms.add_aligned_dim(distance=d["offset"],**attrs)
            dim.render()
            # ezdxf places the aligned text/block using a rotated-linear factory.
            # Store the native aligned DIMENSION flag so readers can identify the sleeve measurement.
            dim.dimension.dxf.dimtype = 33
        else:
            dim = ms.add_linear_dim(base=xy(d["start"]),angle=90 if d["axis"]=="y" else 0,**attrs)
            dim.render()
    output = StringIO()
    doc.write(output)
    return output.getvalue()


def render_solution(solution, drawing, brief, geometry=None):
    geom = geometry or drawing.get("geometryModel")
    if geom is None:
        result = subprocess.run(["node", str(ROOT / "drawing_model.mjs")], input=json.dumps(solution), encoding="utf-8",
                                capture_output=True, check=True, timeout=15)
        geom = json.loads(result.stdout)
    s,b = design_text(solution,brief)
    d = {k:v for k,v in drawing.items() if k not in ("geometryModel","svg","dxf")}
    return {"solution":s,"drawing":dict(d,svg=svg_drawing(geom),dxf=dxf_drawing(geom)),"brief":b}


def make_workbook(sheets):
    output = BytesIO()
    with xlsxwriter.Workbook(output, {"constant_memory":True,"strings_to_formulas":False,"strings_to_urls":False}) as book:
        body = book.add_format({"font_name":"Microsoft YaHei","font_size":11,"text_wrap":True,"valign":"top"})
        heading = book.add_format({"font_name":"Microsoft YaHei","font_size":11,"bold":True,"bg_color":"#12333D","font_color":"#FFFFFF","valign":"vcenter","text_wrap":True})
        for table in sheets:
            ws = book.add_worksheet(table["name"])
            ws.freeze_panes(1,0)
            widths = table["widths"]
            for col,width in enumerate(widths):
                ws.set_column(col,col,width)
            for row,values in enumerate(table["rows"]):
                fmt = heading if row == 0 else body
                lines = 1
                for col,value in enumerate(values):
                    if value is None:
                        continue
                    if isinstance(value,(int,float)) and not isinstance(value,bool):
                        ws.write_number(row,col,value,fmt)
                    else:
                        text = str(value)
                        ws.write_string(row,col,text,fmt)
                        lines = max(lines,sum(max(1,ceil(sum(2 if ord(ch)>127 else 1 for ch in line)/max(widths[col]-2,1))) for line in text.splitlines()))
                ws.set_row(row,25 if row == 0 else min(409,max(21,lines*16)))
            if table["rows"]:
                ws.autofilter(0,0,len(table["rows"])-1,len(widths)-1)
    return output.getvalue()


def render_export(model, kind):
    if kind not in {"xlsx","bundle","delivery"}:
        raise ValueError("未知交付格式")
    s,b = design_text(model["solution"],model["brief"])
    sheets = deepcopy(model["sheets"])
    sections = {sec["title"]:sec["body"] for sec in s["sections"]}
    prompts = {item["title"]:item["text"] for item in b["prompts"]}
    for sheet in sheets:
        for row in sheet["rows"][1:]:
            if len(row) < 3 or row[0] != s["version"]:
                continue
            if sheet["name"] == "方案与资源" and row[1] == "方案段落":
                row[4] = sections.get(row[3],row[4])
            if sheet["name"] == "视觉与图纸" and row[1] in prompts:
                row[2] = prompts[row[1]]
    workbook = make_workbook(sheets)
    if kind == "xlsx":
        return workbook
    if set(model["textFiles"]) != TEXT_FILES:
        raise ValueError("案例包文本文件不完整")
    files = {name:text.encode("utf-8") for name,text in model["textFiles"].items()}
    files["04-海派定制整体方案初稿.md"] = TEMPLATES.get_template("reference-plan.md.j2").render(model=model,solution=s).encode()
    files["06-成套标准化AI视觉提示词.md"] = TEMPLATES.get_template("visual-prompts.md.j2").render(model=model,brief=b).encode()
    files["08-定制业务专题台账.xlsx"] = workbook
    files["09-款式技术平面图.svg"] = svg_drawing(model["geometry"]).encode()
    files["10-款式技术平面图.dxf"] = dxf_drawing(model["geometry"]).encode()
    manifest = deepcopy(model["manifest"])
    manifest["rendering"] = {"proposal":f"Jinja2 {library_version('Jinja2')}", "visualPrompts":f"Jinja2 {library_version('Jinja2')}",
        "drawingSvg":"Python xml.etree.ElementTree", "drawingDxf":f"ezdxf {ezdxf.__version__}",
        "ledger":f"XlsxWriter {xlsxwriter.__version__}", "archive":"Python zipfile"}
    expected = {p["file"]:p for p in manifest["visual"]["photos"]["views"]}
    if kind == "delivery" and (manifest["packagePurpose"] != "核对版交付包" or
            {p["key"] for p in expected.values() if p["reviewStatus"] in ("reviewed","advisor-reviewed")} != set(PHOTO_NAMES)):
        raise ValueError("核对版要求三张完整的同版已核照片")
    for name, photo in expected.items():
        group = {"changes-requested":"待调整效果图", "pending":"待复核效果图",
                 "reviewed":"写实效果图", "advisor-reviewed":"写实效果图"}.get(photo["reviewStatus"])
        if not group or photo["key"] not in PHOTO_NAMES or name != group + "/" + PHOTO_NAMES[photo["key"]]:
            raise ValueError("照片归档位置与同版视角或状态不符")
    for photo in model["photoFiles"]:
        name = photo["file"]
        binary = base64.b64decode(photo["data"],validate=True)
        if name not in expected or sha256(binary).hexdigest() != expected[name]["sha256"]:
            raise ValueError("写实图文件摘要与本版登记不同")
        files[name] = binary
    manifest_name = "11-交付验收清单.json"
    if set(files) | {manifest_name} != set(manifest["deliverables"]):
        raise ValueError("归档文件集合与收件清单不同")
    files[manifest_name] = json.dumps(manifest,ensure_ascii=False,indent=2).encode()
    output = BytesIO()
    with ZipFile(output,"w",compression=ZIP_DEFLATED,compresslevel=6) as archive:
        for name in manifest["deliverables"]:
            archive.writestr(name,files[name],compress_type=ZIP_STORED if name in expected else ZIP_DEFLATED)
    return output.getvalue()
