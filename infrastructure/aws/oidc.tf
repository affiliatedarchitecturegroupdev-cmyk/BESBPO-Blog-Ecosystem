# AWS OIDC Configuration for GitHub Actions
# Reference: Master Plan Section 4
# Enables secretless deployments using OIDC token exchange

terraform {
  required_version = ">= 1.0.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

# ============================================================================
# OIDC Identity Provider for GitHub
# ============================================================================
resource "aws_iam_openid_connect_provider" "github" {
  url = "https://token.actions.githubusercontent.com"

  client_id_list = [
    "sts.amazonaws.com",
  ]

  thumbprint_list = [
    # GitHub's OIDC thumbprint (SHA1 of the root CA)
    "6938fd4d98bab03faadb97b34396831e3780aea1",
  ]

  tags = {
    Environment = "production"
    Platform    = "BESBPO-Blog"
  }
}

# ============================================================================
# IAM Role for GitHub Actions (staging)
# ============================================================================
resource "aws_iam_role" "github_actions_staging" {
  name = "besbpo-github-actions-staging"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Federated = aws_iam_openid_connect_provider.github.arn
        }
        Action = "sts:AssumeRoleWithWebIdentity"
        Condition = {
          StringEquals = {
            "token.actions.githubusercontent.com:aud" = "sts.amazonaws.com"
          }
          StringLike = {
            "token.actions.githubusercontent.com:sub" = "repo:affiliatedarchitecturegroupdev-cmyk/*:*"
          }
        }
      }
    ]
  })

  tags = {
    Environment = "staging"
    Platform    = "BESBPO-Blog"
  }
}

# ============================================================================
# IAM Role for GitHub Actions (production)
# ============================================================================
resource "aws_iam_role" "github_actions_production" {
  name = "besbpo-github-actions-production"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Federated = aws_iam_openid_connect_provider.github.arn
        }
        Action = "sts:AssumeRoleWithWebIdentity"
        Condition = {
          StringEquals = {
            "token.actions.githubusercontent.com:aud" = "sts.amazonaws.com"
          }
          # Restrict to specific repositories only
          StringLike = {
            "token.actions.githubusercontent.com:sub" = [
              "repo:affiliatedarchitecturegroupdev-cmyk/besbpo-blog-cms-api:ref:refs/heads/main",
              "repo:affiliatedarchitecturegroupdev-cmyk/besbpo-blog-intelligence-svc:ref:refs/heads/main",
              "repo:affiliatedarchitecturegroupdev-cmyk/besbpo-blog-syndication-svc:ref:refs/heads/main",
            ]
          }
        }
      }
    ]
  })

  tags = {
    Environment = "production"
    Platform    = "BESBPO-Blog"
  }
}

# ============================================================================
# Policy: S3 Deployment (staging)
# ============================================================================
resource "aws_iam_policy" "s3_deploy_staging" {
  name = "besbpo-s3-deploy-staging"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:PutObject",
          "s3:GetObject",
          "s3:DeleteObject",
          "s3:ListBucket",
        ]
        Resource = [
          "arn:aws:s3:::besbpo-blog-staging/*",
          "arn:aws:s3:::besbpo-blog-staging",
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "cloudfront:CreateInvalidation",
          "cloudfront:GetInvalidation",
          "cloudfront:ListInvalidations",
        ]
        Resource = "arn:aws:cloudfront::*:distribution/*"
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "s3_deploy_staging" {
  role       = aws_iam_role.github_actions_staging.name
  policy_arn = aws_iam_policy.s3_deploy_staging.arn
}

# ============================================================================
# Policy: ECR Deployment (production)
# ============================================================================
resource "aws_iam_policy" "ecr_deploy_production" {
  name = "besbpo-ecr-deploy-production"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "ecr:GetAuthorizationToken",
          "ecr:BatchCheckLayerAvailability",
          "ecr:GetDownloadUrlForLayer",
          "ecr:BatchGetImage",
          "ecr:PutImage",
          "ecr:InitiateLayerUpload",
          "ecr:UploadLayerPart",
          "ecr:CompleteLayerUpload",
        ]
        Resource = "arn:aws:ecr:*:${data.aws_caller_identity.current.account_id}:repository/besbpo-*"
      },
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:ListBucket",
        ]
        Resource = [
          "arn:aws:s3:::besbpo-blog-production/*",
          "arn:aws:s3:::besbpo-blog-production",
        ]
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "ecr_deploy_production" {
  role       = aws_iam_role.github_actions_production.name
  policy_arn = aws_iam_policy.ecr_deploy_production.arn
}

# ============================================================================
# Data Sources
# ============================================================================
data "aws_caller_identity" "current" {}

# ============================================================================
# Outputs
# ============================================================================
output "github_actions_staging_role_arn" {
  description = "ARN of the staging GitHub Actions role"
  value       = aws_iam_role.github_actions_staging.arn
}

output "github_actions_production_role_arn" {
  description = "ARN of the production GitHub Actions role"
  value       = aws_iam_role.github_actions_production.arn
}

output "oidc_provider_arn" {
  description = "ARN of the OIDC provider"
  value       = aws_iam_openid_connect_provider.github.arn
}
