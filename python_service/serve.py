import os
import uvicorn


if __name__ == '__main__':
    if len(os.environ.get('SHANGFU_SERVICE_TOKEN', '')) < 32:
        raise SystemExit('Set a private SHANGFU_SERVICE_TOKEN of at least 32 characters.')
    uvicorn.run('python_service.app:app', host='0.0.0.0', port=int(os.environ.get('PORT', '8080')))
