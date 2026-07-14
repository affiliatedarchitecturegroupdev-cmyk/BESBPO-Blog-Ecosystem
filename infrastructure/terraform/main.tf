# Terraform Configuration for BESBPO Blog Platform
# Reference: Master Plan Section 7 - IaC & Observability
# 
# This Terraform configuration provisions the infrastructure for:
# - AWS EKS (Kubernetes cluster)
# - AWS RDS (PostgreSQL via Supabase)
# - AWS ElastiCache (Redis via Upstash)
# - AWS S3 (Media storage)
# - AWS CloudWatch (Logging and monitoring)

terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.0"
    }
    helm = {
      source  = "hashicorp/helm"
      version = "~> 2.0"
    }
  }

  backend "s3" {
    bucket = "besbpo-terraform-state"
    key    = "infrastructure/terraform.tfstate"
    region = "af-south-1"
    dynamodb_table = "besbpo-terraform-locks"
  }
}

# ============================================
# Variables
# ============================================

variable "environment" {
  description = "Environment name (staging/production)"
  type        = string
  validation {
    condition     = contains(["staging", "production"], var.environment)
    error_message = "Environment must be 'staging' or 'production'."
  }
}

variable "region" {
  description = "AWS region"
  type        = string
  default     = "af-south-1"
}

variable "cluster_name" {
  description = "EKS cluster name"
  type        = string
  default     = "besbpo-blog"
}

variable "cluster_version" {
  description = "Kubernetes version"
  type        = string
  default     = "1.28"
}

variable "domain_name" {
  description = "Base domain name for the platform"
  type        = string
  default     = "besbpo.co.za"
}

# ============================================
# Provider Configuration
# ============================================

provider "aws" {
  region = var.region
  
  default_tags {
    tags = {
      Project     = "besbpo-blog"
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  }
}

# ============================================
# VPC and Networking
# ============================================

module "vpc" {
  source = "terraform-aws-modules/vpc/aws"

  name = "${var.cluster_name}-vpc"
  cidr = var.environment == "production" ? "10.0.0.0/16" : "10.1.0.0/16"

  azs             = ["${var.region}a", "${var.region}b", "${var.region}c"]
  private_subnets = var.environment == "production" ? ["10.0.1.0/24", "10.0.2.0/24", "10.0.3.0/24"] : ["10.1.1.0/24", "10.1.2.0/24"]
  public_subnets  = var.environment == "production" ? ["10.0.101.0/24", "10.0.102.0/24", "10.0.103.0/24"] : ["10.1.101.0/24", "10.1.102.0/24"]

  enable_nat_gateway     = true
  single_nat_gateway     = var.environment == "staging"
  enable_dns_hostnames   = true
  enable_dns_support     = true

  tags = {
    Name = "${var.cluster_name}-vpc"
  }
}

# ============================================
# EKS Cluster
# ============================================

module "eks" {
  source = "terraform-aws-modules/eks/aws"

  cluster_name    = "${var.cluster_name}-${var.environment}"
  cluster_version = var.cluster_version
  cluster_endpoint_public_access = true

  vpc_id     = module.vpc.vpc_id
  subnet_ids = module.vpc.private_subnets

  eks_managed_node_groups = {
    main = {
      name         = "main"
      instance_type = var.environment == "production" ? "m5.xlarge" : "t3.medium"
      min_size      = var.environment == "production" ? 3 : 1
      max_size      = var.environment == "production" ? 10 : 3
      desired_size  = var.environment == "production" ? 3 : 1

      labels = {
        role = "general"
      }

      additional_tags = {
        NodeGroup = "main"
      }
    }
  }

  cluster_addons = {
    coredns = {
      most_recent = true
    }
    kube-proxy = {
      most_recent = true
    }
    vpc-cni = {
      most_recent = true
    }
  }
}

# ============================================
# AWS Load Balancer Controller
# ============================================

resource "helm_release" "aws_lb_controller" {
  name = "aws-load-balancer-controller"

  repository = "https://aws.github.io/eks-charts"
  chart      = "aws-load-balancer-controller"
  namespace  = "kube-system"
  version    = "1.6.0"

  set {
    name  = "clusterName"
    value = module.eks.cluster_name
  }

  depends_on = [module.eks]
}

# ============================================
# External DNS
# ============================================

resource "helm_release" "external_dns" {
  name = "external-dns"

  repository = "bitnami-labs/external-dns"
  chart      = "external-dns"
  namespace  = "kube-system"
  version    = "1.13.0"

  set {
    name  = "provider"
    value = "aws"
  }

  set {
    name  = "aws.region"
    value = var.region
  }

  set {
    name  = "domainFilters[0]"
    value = var.domain_name
  }

  depends_on = [module.eks]
}

# ============================================
# Cert Manager (TLS Certificates)
# ============================================

resource "helm_release" "cert_manager" {
  name = "cert-manager"

  repository = "jetstack/cert-manager"
  chart      = "cert-manager"
  namespace  = "cert-manager"
  version    = "1.13.0"
  create_namespace = true

  set {
    name  = "installCRDs"
    value = "true"
  }

  set {
    name  = "controller.clusterIssuer"
    value = "letsencrypt-prod"
  }

  depends_on = [module.eks]
}

# ============================================
# S3 Bucket for Media Storage
# ============================================

resource "aws_s3_bucket" "media" {
  bucket = "${var.cluster_name}-media-${var.environment}"

  tags = {
    Name        = "${var.cluster_name}-media"
    Environment = var.environment
  }
}

resource "aws_s3_bucket_versioning" "media" {
  bucket = aws_s3_bucket.media.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "media" {
  bucket = aws_s3_bucket.media.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "media" {
  bucket = aws_s3_bucket.media.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# ============================================
# CloudWatch Log Group
# ============================================

resource "aws_cloudwatch_log_group" "eks" {
  name              = "/aws/eks/${var.cluster_name}-${var.environment}/cluster"
  retention_in_days = var.environment == "production" ? 90 : 14

  tags = {
    Environment = var.environment
  }
}

# ============================================
# IAM Roles for Service Accounts
# ============================================

# CMS API Service Account
resource "aws_iam_role" "cms_api" {
  name = "${var.cluster_name}-cms-api-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRoleWithWebIdentity"
      Effect = "Allow"
      Principal = {
        Federated = module.eks.oidc_provider
      }
      Condition = {
        StringEquals = {
          "${module.eks.oidc_provider}:sub" = "system:serviceaccount:besbpo:cms-api"
        }
      }
    }]
  })
}

resource "aws_iam_role_policy" "cms_api" {
  name = "${var.cluster_name}-cms-api-policy"
  role = aws_iam_role.cms_api.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject"
        ]
        Resource = [
          "${aws_s3_bucket.media.arn}/*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue"
        ]
        Resource = [
          "arn:aws:secretsmanager:${var.region}:*:secret:${var.cluster_name}/*"
        ]
      }
    ]
  })
}

# ============================================
# Kubernetes Namespaces
# ============================================

resource "kubernetes_namespace" "besbpo" {
  metadata {
    name = "besbpo"

    labels = {
      name = "besbpo"
    }
  }
}

# ============================================
# Outputs
# ============================================

output "cluster_endpoint" {
  description = "EKS cluster endpoint"
  value       = module.eks.cluster_endpoint
}

output "cluster_name" {
  description = "EKS cluster name"
  value       = module.eks.cluster_name
}

output "cluster_oidc_issuer" {
  description = "OIDC issuer URL"
  value       = module.eks.oidc_provider
}

output "media_bucket_name" {
  description = "S3 media bucket name"
  value       = aws_s3_bucket.media.id
}

output "vpc_id" {
  description = "VPC ID"
  value       = module.vpc.vpc_id
}
