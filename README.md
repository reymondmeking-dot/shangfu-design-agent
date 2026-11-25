# 海派定制服饰 AI 需求解构与可视化 Agent

客户说「想穿得利落一点」时，顾问需要知道穿去哪里、肩背要留多少活动量，以及哪些面料适合。这个工作台保留客户原话，把顾问确认过的要求连到模拟资产、方案、图纸和台账。版师退回一版，可以沿项目编号找到改动和对应图纸。

适用于定制业务专员、职业服方案设计师和高级定制企划人员。公开源码配有 31 项模拟资产和两个独立编写的虚构项目。正式洽谈记录、个人量体数据和生产系统均在演示范围之外。

[观看 45 秒操作演示](https://planto-ai.com/design/video) ｜ [在线演示](https://planto-ai.com/design) ｜ [在线项目简介](https://planto-ai.com/design/overview) ｜ [技术路线、业务边界与接口](docs/architecture.md)

一张 40 人酒店礼宾服模拟订单贯穿全片。依次录入原话、核对机洗要求、选择藏蓝斜纹、查看成衣与袋口，再把门襟从 30 mm 改到 35 mm。最后打开五表台账，将获批的试穿检查带入下一单。普通话旁白采用小米 MiMo TTS 的白桦男声，配乐为原创钢琴独奏《窗边的样衣》，附中英字幕。[下载最新版 1080p MP4](https://github.com/reymondmeking-dot/shangfu-design-agent/releases/latest/download/shangfu-design-agent-demo.mp4)

钢琴音源为 Alexander Holm 录制、kinwie 整理的 Yamaha C5 采样。本片使用这些采样演奏、移调并混响。[Salamander Grand Piano v3](https://sfzinstruments.github.io/pianos/salamander/) ｜ [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/)

## 运行工作台

准备 Node.js 22 或以上、npm 和 Python 3.11 或 3.12。在仓库根目录运行以下命令。

```sh
npm ci
python -m venv .venv
```

Windows PowerShell 中运行以下命令。

```powershell
.\.venv\Scripts\python.exe -m pip install -r python_service/requirements.txt
.\.venv\Scripts\python.exe run.py --port 4873
```

macOS 或 Linux 中运行以下命令。

```sh
.venv/bin/python -m pip install -r python_service/requirements.txt
.venv/bin/python run.py --port 4873
```

打开 [本机工作台](http://127.0.0.1:4873/design-agent)。启动器同时启动 Node 界面和 FastAPI，生成进程间凭据，把项目和图片复核记录写入 `.state`。在侧栏打开“本地项目库”可保存草稿、查看项目列表和连接状态。项目选择框旁可删除当前项目。按 Ctrl+C 停止。换端口可运行 `python run.py --port 4714`。

## 在演示中观察什么

启动服务后，打开 `/design` 可以逐步查看两张模拟订单并下载同版档案。`/design-agent` 是可录入新需求的业务工作台。`/design/video` 提供带章节的配音影片，使用 GitHub Release 保存的 MP4。

| 模拟项目 | 可以核对的结果 |
| --- | --- |
| 澄溪画廊开幕酒会 | 首版采用交领和无扣开襟。若客户改要低立领，由顾问重新确认，更新版型及同版 SVG、DXF 和三种视觉提示词。 |
| 云汀会馆礼宾夹克 | 40 名礼宾员要求统一深藏蓝、可机洗并方便搬运行李。核对推荐面料和双嵌线袋口，打开已核对的成衣、细节和上身三张模拟图。 |

从礼宾案例载入原话，确认字段并生成 V1。可以让版师退回门襟，改为 35 mm 后重出 V2，核对新图纸，对 V2 签署复核意见，归档并导出可编辑台账。再批准一条试穿检查项，新建项目时选择复用。上一单的检查项和来源可追溯，新客户另行录入需求与量体。

## 模型和效果图

基础流程可离线运行。接入 Ollama 前，在自己的模型服务上执行 `ollama pull qwen3:4b`。为启动器设置 `SHANGFU_OLLAMA_URL`（如 `http://127.0.0.1:11434`）和可选的 `SHANGFU_OLLAMA_MODEL`。FastAPI 校验模型输出结构和引用原句。模型缺席、超时或引用无效时，接口返回规则解构和降级原因。工作台的 `/design-agent/api/health` 会显示当前连接状态。

所有方案均能生成参数驱动的三视图示意与视觉需求包。礼宾案例有三张经核对的写实样图。其他输入或改版需重新生成或人工核对；本机基础配置提供提示词、尺寸和技术参考图。可选的实时写实出图使用 Cloudflare Workers AI 与 Images，需要自己有权使用的服务绑定、额度和签名密钥。详情见[技术路线与接口](docs/architecture.md)。

## 执行验收

```sh
npm test
python test/python-workflow.py -v
```

上述第二行请使用已安装依赖的虚拟环境解释器。第一组测试读取两套模拟输入和礼宾 JPG 原始文件，核对资源编号、图纸尺寸、视觉输出目标，以及改版后旧图失效。第二组通过实际 HTTP 服务检查人工确认、并发改版、退回、复核、归档、重启后 SQLite 追溯和跨项目复用，还会解包服务生成的 XLSX 和 ZIP。模型协议测试使用受控响应来覆盖引用有效与无效两条分支。
