#!/bin/bash

# AWS EC2 Auto Deployment Script for EHealth Med AI
# Non-interactive version with defaults

set -e

echo "🚀 Starting AWS EC2 Auto Deployment for EHealth Med AI"
echo "=================================================="
echo ""

# Default values
AWS_REGION=${AWS_REGION:-us-east-1}
KEY_NAME=${KEY_NAME:-""}
MY_IP=${MY_IP:-0.0.0.0/0}

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Check AWS CLI
if ! command -v aws &> /dev/null; then
    echo -e "${RED}❌ AWS CLI is not installed${NC}"
    exit 1
fi

# Verify credentials
if ! aws sts get-caller-identity &> /dev/null; then
    echo -e "${RED}❌ AWS credentials not configured${NC}"
    exit 1
fi

echo -e "${GREEN}✅ AWS CLI configured${NC}"
echo ""

# Get or create key pair
if [ -z "$KEY_NAME" ]; then
    echo "🔑 Checking for existing key pairs..."
    EXISTING_KEYS=$(aws ec2 describe-key-pairs --region $AWS_REGION --query 'KeyPairs[*].KeyName' --output text 2>/dev/null || echo "")
    
    if [ -n "$EXISTING_KEYS" ]; then
        KEY_NAME=$(echo $EXISTING_KEYS | awk '{print $1}')
        echo -e "${GREEN}✅ Using existing key pair: $KEY_NAME${NC}"
    else
        echo "🔑 No key pairs found. Creating new one..."
        KEY_NAME="ehealth-key-$(date +%s)"
        
        # Create key pair
        aws ec2 create-key-pair \
            --region $AWS_REGION \
            --key-name $KEY_NAME \
            --query 'KeyMaterial' \
            --output text > ~/${KEY_NAME}.pem 2>/dev/null || {
            echo -e "${RED}❌ Failed to create key pair${NC}"
            echo "Please create a key pair manually in AWS Console"
            exit 1
        }
        
        chmod 400 ~/${KEY_NAME}.pem
        echo -e "${GREEN}✅ Created key pair: $KEY_NAME${NC}"
        echo -e "${YELLOW}⚠️  Key saved to: ~/${KEY_NAME}.pem${NC}"
    fi
fi

echo ""
echo "📋 Configuration:"
echo "   Region: $AWS_REGION"
echo "   Key Pair: $KEY_NAME"
echo "   SSH Access: $MY_IP"
echo "   Instance Type: t3.small"
echo "   Storage: 20 GB gp3"
echo "   OS: Ubuntu 22.04 LTS"
echo ""

# Get default VPC
VPC_ID=$(aws ec2 describe-vpcs --region $AWS_REGION --filters "Name=isDefault,Values=true" --query "Vpcs[0].VpcId" --output text 2>/dev/null || \
    aws ec2 describe-vpcs --region $AWS_REGION --query "Vpcs[0].VpcId" --output text)

if [ "$VPC_ID" == "None" ] || [ -z "$VPC_ID" ]; then
    echo -e "${RED}❌ No VPC found${NC}"
    exit 1
fi

echo "   Using VPC: $VPC_ID"

# Create security group
SG_NAME="ehealth-sg"
SG_DESCRIPTION="Security group for EHealth Med AI"

echo ""
echo "🔧 Creating security group..."

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

echo -e "${GREEN}✅ Security group: $SG_ID${NC}"

# Add rules (ignore errors if already exist)
echo "🔐 Configuring security group rules..."
aws ec2 authorize-security-group-ingress --region $AWS_REGION --group-id $SG_ID --protocol tcp --port 22 --cidr $MY_IP --output text &>/dev/null || true
aws ec2 authorize-security-group-ingress --region $AWS_REGION --group-id $SG_ID --protocol tcp --port 80 --cidr 0.0.0.0/0 --output text &>/dev/null || true
aws ec2 authorize-security-group-ingress --region $AWS_REGION --group-id $SG_ID --protocol tcp --port 443 --cidr 0.0.0.0/0 --output text &>/dev/null || true
aws ec2 authorize-security-group-ingress --region $AWS_REGION --group-id $SG_ID --protocol tcp --port 5000 --cidr 0.0.0.0/0 --output text &>/dev/null || true
aws ec2 authorize-security-group-ingress --region $AWS_REGION --group-id $SG_ID --protocol tcp --port 3000 --cidr 0.0.0.0/0 --output text &>/dev/null || true

echo -e "${GREEN}✅ Security group rules configured${NC}"

# Get Ubuntu 22.04 AMI
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

# Launch instance
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

aws ec2 wait instance-running --region $AWS_REGION --instance-ids $INSTANCE_ID

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
echo "   Key Pair: $KEY_NAME"
echo ""
echo "🔗 Connect to your instance:"
echo "   ssh -i ~/${KEY_NAME}.pem ubuntu@$PUBLIC_IP"
echo ""
echo "📝 Next Steps:"
echo "   1. Wait 1-2 minutes for instance to fully initialize"
echo "   2. Connect using the SSH command above"
echo "   3. Follow AWS_EHEALTH.md guide starting from Step 3"
echo ""

