#!/bin/bash

# AWS EC2 Deployment Script for EHealth Med AI
# This script creates an EC2 instance with all required configurations

set -e  # Exit on error

echo "🚀 Starting AWS EC2 Deployment for EHealth Med AI"
echo "=================================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
    echo -e "${RED}❌ AWS CLI is not installed${NC}"
    echo "Please install AWS CLI first: https://aws.amazon.com/cli/"
    exit 1
fi

# Check if AWS credentials are configured (via env vars or config)
if [ -z "$AWS_ACCESS_KEY_ID" ] && [ -z "$AWS_SECRET_ACCESS_KEY" ]; then
    # Try to use configured credentials
    if ! aws sts get-caller-identity &> /dev/null; then
        echo -e "${RED}❌ AWS credentials not configured${NC}"
        echo "Please set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY environment variables"
        echo "Or run: aws configure"
        exit 1
    fi
else
    # Export environment variables if provided
    export AWS_ACCESS_KEY_ID
    export AWS_SECRET_ACCESS_KEY
    export AWS_DEFAULT_REGION=${AWS_DEFAULT_REGION:-us-east-1}
    echo -e "${GREEN}✅ Using environment variables for AWS credentials${NC}"
fi

echo -e "${GREEN}✅ AWS CLI configured${NC}"
echo ""

# Get user inputs
read -p "Enter your AWS region (e.g., us-east-1): " AWS_REGION
read -p "Enter your SSH key pair name (must exist in AWS): " KEY_NAME
read -p "Enter your IP address for SSH access (or press Enter for 0.0.0.0/0): " MY_IP
MY_IP=${MY_IP:-0.0.0.0/0}

echo ""
echo "📋 Configuration:"
echo "   Region: $AWS_REGION"
echo "   Key Pair: $KEY_NAME"
echo "   SSH Access: $MY_IP"
echo "   Instance Type: t3.small"
echo "   Storage: 20 GB gp3"
echo "   OS: Ubuntu 22.04 LTS"
echo ""

read -p "Continue? (y/n): " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Cancelled."
    exit 1
fi

echo ""
echo "🔧 Creating security group..."

# Get default VPC ID
VPC_ID=$(aws ec2 describe-vpcs --region $AWS_REGION --filters "Name=isDefault,Values=true" --query "Vpcs[0].VpcId" --output text)

if [ "$VPC_ID" == "None" ] || [ -z "$VPC_ID" ]; then
    echo -e "${YELLOW}⚠️  No default VPC found, getting first VPC...${NC}"
    VPC_ID=$(aws ec2 describe-vpcs --region $AWS_REGION --query "Vpcs[0].VpcId" --output text)
fi

echo "   Using VPC: $VPC_ID"

# Create security group
SG_NAME="ehealth-sg"
SG_DESCRIPTION="Security group for EHealth Med AI - PostgreSQL, Backend, Frontend"

SG_ID=$(aws ec2 create-security-group \
    --region $AWS_REGION \
    --group-name $SG_NAME \
    --description "$SG_DESCRIPTION" \
    --vpc-id $VPC_ID \
    --query 'GroupId' \
    --output text 2>/dev/null || \
    aws ec2 describe-security-groups \
    --region $AWS_REGION \
    --filters "Name=group-name,Values=$SG_NAME" "Name=vpc-id,Values=$VPC_ID" \
    --query "SecurityGroups[0].GroupId" \
    --output text)

if [ "$SG_ID" == "None" ] || [ -z "$SG_ID" ]; then
    echo -e "${RED}❌ Failed to create/get security group${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Security group created: $SG_ID${NC}"

# Add security group rules
echo "🔐 Configuring security group rules..."

# SSH
aws ec2 authorize-security-group-ingress \
    --region $AWS_REGION \
    --group-id $SG_ID \
    --protocol tcp \
    --port 22 \
    --cidr $MY_IP \
    --output text &>/dev/null || echo "   SSH rule already exists"

# HTTP
aws ec2 authorize-security-group-ingress \
    --region $AWS_REGION \
    --group-id $SG_ID \
    --protocol tcp \
    --port 80 \
    --cidr 0.0.0.0/0 \
    --output text &>/dev/null || echo "   HTTP rule already exists"

# HTTPS
aws ec2 authorize-security-group-ingress \
    --region $AWS_REGION \
    --group-id $SG_ID \
    --protocol tcp \
    --port 443 \
    --cidr 0.0.0.0/0 \
    --output text &>/dev/null || echo "   HTTPS rule already exists"

# Backend API (5000)
aws ec2 authorize-security-group-ingress \
    --region $AWS_REGION \
    --group-id $SG_ID \
    --protocol tcp \
    --port 5000 \
    --cidr 0.0.0.0/0 \
    --output text &>/dev/null || echo "   Port 5000 rule already exists"

# Frontend (3000) - optional
aws ec2 authorize-security-group-ingress \
    --region $AWS_REGION \
    --group-id $SG_ID \
    --protocol tcp \
    --port 3000 \
    --cidr 0.0.0.0/0 \
    --output text &>/dev/null || echo "   Port 3000 rule already exists"

echo -e "${GREEN}✅ Security group rules configured${NC}"

# Get Ubuntu 22.04 LTS AMI ID
echo ""
echo "🔍 Finding Ubuntu 22.04 LTS AMI..."
AMI_ID=$(aws ec2 describe-images \
    --region $AWS_REGION \
    --owners 099720109477 \
    --filters \
        "Name=name,Values=ubuntu/images/hvm-ssd/ubuntu-jammy-22.04-amd64-server-*" \
        "Name=state,Values=available" \
    --query "Images | sort_by(@, &CreationDate) | [-1].ImageId" \
    --output text)

if [ "$AMI_ID" == "None" ] || [ -z "$AMI_ID" ]; then
    echo -e "${RED}❌ Could not find Ubuntu 22.04 LTS AMI${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Found AMI: $AMI_ID${NC}"

# Launch EC2 instance
echo ""
echo "🚀 Launching EC2 instance..."

INSTANCE_ID=$(aws ec2 run-instances \
    --region $AWS_REGION \
    --image-id $AMI_ID \
    --instance-type t3.small \
    --key-name $KEY_NAME \
    --security-group-ids $SG_ID \
    --block-device-mappings "[{\"DeviceName\":\"/dev/sda1\",\"Ebs\":{\"VolumeSize\":20,\"VolumeType\":\"gp3\",\"DeleteOnTermination\":true}}]" \
    --tag-specifications "ResourceType=instance,Tags=[{Key=Name,Value=ehealth-med-ai},{Key=Project,Value=EHealthMedAI}]" \
    --query 'Instances[0].InstanceId' \
    --output text)

if [ "$INSTANCE_ID" == "None" ] || [ -z "$INSTANCE_ID" ]; then
    echo -e "${RED}❌ Failed to launch instance${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Instance launched: $INSTANCE_ID${NC}"
echo ""
echo "⏳ Waiting for instance to be running..."

aws ec2 wait instance-running \
    --region $AWS_REGION \
    --instance-ids $INSTANCE_ID

# Get public IP
PUBLIC_IP=$(aws ec2 describe-instances \
    --region $AWS_REGION \
    --instance-ids $INSTANCE_ID \
    --query "Reservations[0].Instances[0].PublicIpAddress" \
    --output text)

echo ""
echo -e "${GREEN}═══════════════════════════════════════════════════${NC}"
echo -e "${GREEN}✅ EC2 Instance Created Successfully!${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════${NC}"
echo ""
echo "📋 Instance Details:"
echo "   Instance ID: $INSTANCE_ID"
echo "   Public IP: $PUBLIC_IP"
echo "   Region: $AWS_REGION"
echo "   Security Group: $SG_ID ($SG_NAME)"
echo ""
echo "🔗 Connect to your instance:"
echo "   ssh -i your-key.pem ubuntu@$PUBLIC_IP"
echo ""
echo "📝 Next Steps:"
echo "   1. Connect to the instance using the command above"
echo "   2. Follow the AWS_EHEALTH.md guide starting from Step 3"
echo "   3. Or run the setup script (if available)"
echo ""
echo -e "${YELLOW}⚠️  Note: It may take 1-2 minutes for the instance to be fully ready${NC}"
echo ""

