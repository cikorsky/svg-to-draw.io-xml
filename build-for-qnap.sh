#!/bin/bash

# QNAP NAS 平台多数为 amd64(Intel/AMD芯片) 或者 arm64(少部分ARM处理型号)
# 在此你需要根据你的NAS实际CPU架构去选择平台：linux/amd64 或 linux/arm64
PLATFORM=${1:-linux/amd64}
IMAGE_NAME="svg-to-drawio"
IMAGE_TAG="0.1.0"
EXPORT_FILE="svg-to-drawio-image-0.1.0.tar"

echo "开始为平台 $PLATFORM 构建 Docker 镜像..."
docker buildx build --platform $PLATFORM -t ${IMAGE_NAME}:${IMAGE_TAG} --load .

if [ $? -eq 0 ]; then
    echo "镜像构建成功！正在导出为离线包 $EXPORT_FILE..."
    docker save -o $EXPORT_FILE ${IMAGE_NAME}:${IMAGE_TAG}
    
    if [ $? -eq 0 ]; then
        echo "==============================================="
        echo "打包完成！文件已保存到: $(pwd)/$EXPORT_FILE"
        echo "请将 $EXPORT_FILE 文件上传到你的 QNAP NAS。"
        echo "并在 QNAP NAS (Container Station) 中选择 '导入映像'。"
        echo "==============================================="
    else
        echo "导出离线包失败，请检查 Docker 服务状态及剩余存储空间。"
    fi
else
    echo "构建失败，请确保本地已开启并运行 Docker Desktop 支持 buildx。"
fi
