# AWS Variables for BESBPO Blog Platform
# Reference: Master Plan Section 4

variable "aws_region" {
  description = "AWS region for resources"
  type        = string
  default     = "eu-west-1"
}

variable "github_repository" {
  description = "GitHub repository owner/name"
  type        = string
  default     = "affiliatedarchitecturegroupdev-cmyk"
}

variable "s3_bucket_staging" {
  description = "S3 bucket name for staging"
  type        = string
  default     = "besbpo-blog-staging"
}

variable "s3_bucket_production" {
  description = "S3 bucket name for production"
  type        = string
  default     = "besbpo-blog-production"
}

variable "ecr_repository_prefix" {
  description = "ECR repository prefix"
  type        = string
  default     = "besbpo"
}
