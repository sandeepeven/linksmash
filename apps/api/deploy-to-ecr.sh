#!/bin/bash
# Script to build and push LinkSmash API Docker image to AWS ECR
# 
# This script builds the Docker image and pushes it to Amazon ECR
# for deployment to AWS App Runner.

# Don't exit on error for repository check - we'll handle it gracefully
set +e

# Configuration
REPOSITORY_NAME="${REPOSITORY_NAME:-linksmash-api}"  # Allow override via env var
IMAGE_TAG="${1:-latest}"  # Use first argument or default to "latest"

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== LinkSmash API - ECR Deployment Script ===${NC}\n"

# Step 1: Get AWS account ID and region
echo -e "${BLUE}Step 1: Getting AWS configuration...${NC}"
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text 2>/dev/null || echo "")
AWS_REGION=$(aws configure get region 2>/dev/null || echo "ap-south-1")

if [ -z "$AWS_ACCOUNT_ID" ]; then
    echo -e "${YELLOW}Warning: Could not get AWS account ID. Please ensure AWS CLI is configured.${NC}"
    echo -e "${YELLOW}You can set it manually: export AWS_ACCOUNT_ID=your-account-id${NC}"
    read -p "Enter your AWS Account ID: " AWS_ACCOUNT_ID
fi

# Allow region override
if [ -n "$AWS_REGION_OVERRIDE" ]; then
    AWS_REGION="$AWS_REGION_OVERRIDE"
fi

echo -e "${GREEN}✓ AWS Account ID: $AWS_ACCOUNT_ID${NC}"
echo -e "${GREEN}✓ AWS Region: $AWS_REGION${NC}"
echo -e "${GREEN}✓ Repository Name: $REPOSITORY_NAME${NC}"

# Step 2: Check if ECR repository exists, create if not
echo -e "\n${BLUE}Step 2: Checking ECR repository...${NC}"
ECR_REPO_URI="$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$REPOSITORY_NAME"

# Check if repository exists
if aws ecr describe-repositories --repository-names "$REPOSITORY_NAME" --region "$AWS_REGION" &>/dev/null; then
    echo -e "${GREEN}✓ Repository exists: $REPOSITORY_NAME${NC}"
else
    echo -e "${YELLOW}Repository doesn't exist or not accessible. Attempting to create...${NC}"
    if aws ecr create-repository \
        --repository-name "$REPOSITORY_NAME" \
        --region "$AWS_REGION" \
        --image-scanning-configuration scanOnPush=true \
        --encryption-configuration encryptionType=AES256 2>/dev/null; then
        echo -e "${GREEN}✓ Repository created: $REPOSITORY_NAME${NC}"
    else
        echo -e "${YELLOW}⚠ Could not create repository (may not have permissions or it may already exist)${NC}"
        echo -e "${YELLOW}⚠ Continuing with existing repository...${NC}"
        echo -e "${YELLOW}⚠ If repository doesn't exist, please create it manually in AWS Console${NC}"
    fi
fi

# Re-enable exit on error for critical steps
set -e

# Step 3: Authenticate Docker to ECR
echo -e "\n${BLUE}Step 3: Authenticating Docker to ECR...${NC}"
aws ecr get-login-password --region "$AWS_REGION" | \
    docker login --username AWS --password-stdin "$ECR_REPO_URI"
echo -e "${GREEN}✓ Docker authenticated${NC}"

# Step 4: Build Docker image
echo -e "\n${BLUE}Step 4: Building Docker image...${NC}"
echo -e "${YELLOW}Note: Building for linux/amd64 platform (required for AWS App Runner)${NC}"
echo -e "${YELLOW}This ensures compatibility even when building on ARM-based systems (M1/M2/M3 Mac)${NC}"
cd "$(dirname "$0")/../.."  # Go to project root
docker build --platform=linux/amd64 -f apps/api/Dockerfile -t "$REPOSITORY_NAME:$IMAGE_TAG" .
echo -e "${GREEN}✓ Image built: $REPOSITORY_NAME:$IMAGE_TAG${NC}"

# Step 5: Tag image for ECR
echo -e "\n${BLUE}Step 5: Tagging image for ECR...${NC}"
docker tag "$REPOSITORY_NAME:$IMAGE_TAG" "$ECR_REPO_URI:$IMAGE_TAG"
docker tag "$REPOSITORY_NAME:$IMAGE_TAG" "$ECR_REPO_URI:latest"
echo -e "${GREEN}✓ Image tagged${NC}"

# Step 6: Push to ECR
echo -e "\n${BLUE}Step 6: Pushing image to ECR...${NC}"
docker push "$ECR_REPO_URI:$IMAGE_TAG"
docker push "$ECR_REPO_URI:latest"
echo -e "${GREEN}✓ Image pushed to ECR${NC}"

# Step 7: Display summary
echo -e "\n${GREEN}=== Deployment Summary ===${NC}"
echo -e "${GREEN}Repository URI: $ECR_REPO_URI${NC}"
echo -e "${GREEN}Image Tag: $IMAGE_TAG${NC}"
echo -e "${GREEN}Latest Tag: latest${NC}"
echo -e "\n${BLUE}Next steps:${NC}"
echo -e "1. Go to AWS App Runner Console"
echo -e "2. Create or select a service → Choose 'Container registry'"
echo -e "3. Choose 'Amazon ECR'"
echo -e "4. Select repository: $REPOSITORY_NAME"
echo -e "5. Select image tag: latest (or $IMAGE_TAG)"
echo -e "6. Set port: 8080"
echo -e "7. Add the following required environment variables:"
echo -e "     - NODE_ENV=production"
echo -e "     - HOST=0.0.0.0"
echo -e "     - PORT=8080"
echo -e "8. (Optional) Set LOG_LEVEL or REDIS_URL if needed"
echo -e "9. Deploy the service"

