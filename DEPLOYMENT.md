# Cloud Run GPU Deployment Guide

This guide explains how to deploy AI music generation models to Google Cloud Run with GPU acceleration.

## Prerequisites

### 1. Bash 4.0+ Required

The deployment script requires **Bash 4.0 or higher**. macOS ships with Bash 3.2 by default.

#### Install Bash 4+ on macOS

```bash
# Install via Homebrew
brew install bash

# Verify installation
/opt/homebrew/bin/bash --version
# Should show: GNU bash, version 5.x or higher
```

#### Use the Script with Bash 4+

Option 1: Run directly with Homebrew Bash
```bash
/opt/homebrew/bin/bash deploy-cloud-run.sh --help
```

Option 2: Update your PATH (recommended)
```bash
# Add to ~/.zshrc or ~/.bash_profile
export PATH="/opt/homebrew/bin:$PATH"

# Reload shell
source ~/.zshrc

# Now you can run:
./deploy-cloud-run.sh --help
```

### 2. Google Cloud SDK

```bash
# Install gcloud CLI
brew install --cask google-cloud-sdk

# Authenticate
gcloud auth login

# Set your project
gcloud config set project YOUR_PROJECT_ID

# Enable required APIs
gcloud services enable run.googleapis.com
gcloud services enable artifactregistry.googleapis.com
```

---

## Usage

### Deploy a Model

```bash
# Basic deployment
./deploy-cloud-run.sh musicgen-medium europe-west4

# Custom GPU
./deploy-cloud-run.sh musicgen-large us-central1 --gpu nvidia-a100-40gb

# Preview without deploying
./deploy-cloud-run.sh stable-audio europe-west4 --dry-run
```

### Destroy a Deployment

```bash
# Delete a deployed service
./deploy-cloud-run.sh --destroy musicgen-medium europe-west4

# You will be prompted to confirm deletion
```

### View Help

```bash
./deploy-cloud-run.sh --help
```

### View GPU Pricing

```bash
./deploy-cloud-run.sh --pricing
```

---

## Available Models

| Model | Size | GPU | Monthly Cost (24/7) |
|-------|------|-----|---------------------|
| musicgen-small | 300M | nvidia-l4 | ~$504 |
| musicgen-medium | 1.5B | nvidia-l4 | ~$504 |
| musicgen-large | 3.3B | nvidia-rtx-pro-6000 | ~$1,512 |
| stable-audio | 1.5B | nvidia-l4 | ~$504 |
| mustango | 1B | nvidia-l4 | ~$504 |

**Note:** Use `--min-instances=0` (default) for scale-to-zero to only pay when generating music.

---

## GPU Options

| GPU Type | vCPU | Memory | GPU Memory | $/hour |
|----------|------|--------|------------|--------|
| nvidia-l4 | 8 | 32GB | 24GB | ~$0.70 |
| nvidia-rtx-pro-6000 | 20 | 80GB | 48GB | ~$2.10 |
| nvidia-a100-40gb | 12 | 85GB | 40GB | ~$3.67 |
| nvidia-a100-80gb | 12 | 170GB | 80GB | ~$4.96 |
| nvidia-h100-80gb | 24 | 340GB | 80GB | ~$8.50 |

---

## Regions with GPU Support

- **us-central1** (Iowa, USA) - Cheapest, best availability
- **europe-west4** (Netherlands) - EU data residency
- **asia-northeast1** (Tokyo, Japan)

---

## Command-Line Options

```
Options:
  --destroy         Delete the deployed service (requires MODEL and REGION)
  --gpu TYPE        Override GPU type (default: based on model)
  --cpu COUNT       Override CPU count (default: based on model)
  --memory SIZE     Override memory (default: based on model)
  --min-instances N Minimum instances (default: 0 for scale-to-zero)
  --max-instances N Maximum instances (default: 3)
  --dry-run         Show command without executing
  --pricing         Show GPU pricing table
  --help, -h        Show this help message
```

---

## Cost Optimization Tips

1. **Scale to Zero** - Use `--min-instances=0` (default) to pay only when generating
2. **Choose Right GPU** - L4 is sufficient for most models (<2B params)
3. **Region Selection** - us-central1 is typically cheapest
4. **Committed Use** - Consider committed use discounts for production (up to 57% off)
5. **Monitoring** - Set up billing alerts in Google Cloud Console

---

## Troubleshooting

### Error: "declare: -A: invalid option"

This means you're using Bash 3.2. Install Bash 4+ via Homebrew:

```bash
brew install bash
/opt/homebrew/bin/bash deploy-cloud-run.sh --help
```

### Error: "gcloud: command not found"

Install the Google Cloud SDK:

```bash
brew install --cask google-cloud-sdk
gcloud auth login
```

### Error: "Project not set"

Set your Google Cloud project:

```bash
gcloud config set project YOUR_PROJECT_ID
```

### Service Won't Start

Check Cloud Run logs:

```bash
gcloud run logs read --service lyria-musicgen-medium --region europe-west4
```

---

## Example Workflow

```bash
# 1. Install Bash 4+
brew install bash

# 2. Set up Google Cloud
gcloud auth login
gcloud config set project my-music-project
gcloud services enable run.googleapis.com artifactregistry.googleapis.com

# 3. Deploy a model
/opt/homebrew/bin/bash deploy-cloud-run.sh musicgen-medium europe-west4

# 4. Test the endpoint (URL shown after deployment)
curl https://lyria-musicgen-medium-xxx.run.app/health

# 5. When done, destroy to stop billing
/opt/homebrew/bin/bash deploy-cloud-run.sh --destroy musicgen-medium europe-west4
```

---

## Security Notes

- Services are deployed with `--allow-unauthenticated` for API access
- For production, add authentication:
  ```bash
  gcloud run services update lyria-musicgen-medium \
    --region europe-west4 \
    --no-allow-unauthenticated
  ```
- Use Cloud IAM to control access
- Consider VPC Service Controls for sensitive workloads

---

## Support

For issues or questions:
- Check [MODELS_COMPARISON.md](./MODELS_COMPARISON.md) for model details
- Review [USER_GUIDE.md](./USER_GUIDE.md) for API configuration
- Open an issue on GitHub
