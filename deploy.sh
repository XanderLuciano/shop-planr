#!/bin/bash
set -e

# Configure these for your environment
SERVER="user@your-server.local"
REMOTE_DIR="~/shop-erp"
IMAGE_NAME="shop-erp"

echo "==> Building Nuxt app..."
npm run build

echo "==> Building container image (linux/amd64)..."
docker build --platform linux/amd64 -t $IMAGE_NAME .

echo "==> Exporting and compressing image..."
docker save $IMAGE_NAME -o ${IMAGE_NAME}.tar
gzip -f ${IMAGE_NAME}.tar

echo "==> Transferring to server..."
rsync -avz --progress ${IMAGE_NAME}.tar.gz docker-compose.yml ${SERVER}:${REMOTE_DIR}/

echo "==> Deploying on server..."
ssh ${SERVER} "cd ${REMOTE_DIR} && gunzip -f ${IMAGE_NAME}.tar.gz && docker load -i ${IMAGE_NAME}.tar && docker-compose down && docker-compose up -d"

echo "==> Done! App is live."
