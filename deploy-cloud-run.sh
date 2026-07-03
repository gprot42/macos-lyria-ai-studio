#!/usr/bin/env bash
# ============================================================================
# Lyria AI Studio - Cloud Run GPU Deployment Script
# ============================================================================
# Deploys AI music generation models to Google Cloud Run with GPU acceleration
#
# Prerequisites:
#   1. Google Cloud SDK installed: https://cloud.google.com/sdk/docs/install
#   2. Authenticated: gcloud auth login
#   3. Project set: gcloud config set project YOUR_PROJECT_ID
#   4. APIs enabled:
#      - Cloud Run API
#      - Artifact Registry API
#      - Vertex AI API (for Lyria 2)
#
# Usage:
#   ./deploy-cloud-run.sh [MODEL] [REGION] [OPTIONS]
#
# Examples:
#   ./deploy-cloud-run.sh musicgen-medium europe-west4
#   ./deploy-cloud-run.sh stable-audio us-central1
#   ./deploy-cloud-run.sh --help
#   ./deploy-cloud-run.sh --destroy musicgen-medium europe-west4
# ============================================================================

set -e

# Check Bash version (need 4.0+ for associative arrays)
if [[ "${BASH_VERSINFO[0]}" -lt 4 ]]; then
    echo "ERROR: This script requires Bash 4.0 or higher."
    echo "Current version: ${BASH_VERSION}"
    echo ""
    echo "On macOS, run the setup helper:"
    echo "  ./scripts/ensure-bash4.sh"
    echo ""
    echo "Or install manually (see DEPLOYMENT.md), then run:"
    echo "  /opt/homebrew/bin/bash $0 $*"
    exit 1
fi

# ============================================================================
# GPU PRICING (as of February 2026)
# ============================================================================
# Region: europe-west4 / us-central1
#
# GPU Type              | vCPU | Memory | GPU Memory | $/hour (on-demand)
# ----------------------|------|--------|------------|-------------------
# nvidia-l4             |  8   |  32GB  |    24GB    |  ~$0.70/hr
# nvidia-a100-40gb      |  12  |  85GB  |    40GB    |  ~$3.67/hr
# nvidia-a100-80gb      |  12  |  170GB |    80GB    |  ~$4.96/hr
# nvidia-h100-80gb      |  24  |  340GB |    80GB    |  ~$8.50/hr
# nvidia-rtx-pro-6000   |  20  |  80GB  |    48GB    |  ~$2.10/hr (estimated)
#
# MONTHLY COST ESTIMATES (24/7 running):
# - L4:            ~$504/month
# - A100 40GB:     ~$2,642/month
# - A100 80GB:     ~$3,571/month
# - H100 80GB:     ~$6,120/month
# - RTX Pro 6000:  ~$1,512/month (estimated)
#
# RECOMMENDED GPU BY MODEL:
# - MusicGen Small/Medium: nvidia-l4 (24GB VRAM sufficient)
# - MusicGen Large:        nvidia-rtx-pro-6000 or nvidia-a100-40gb
# - Stable Audio Open:     nvidia-l4 (24GB VRAM sufficient)
# - Mustango:              nvidia-l4 (24GB VRAM sufficient)
#
# COST OPTIMIZATION TIPS:
# 1. Use min-instances=0 for scale-to-zero (pay only when generating)
# 2. Use committed use discounts (up to 57% off)
# 3. Consider spot/preemptible instances for batch workloads
# 4. Region matters: us-central1 is often cheapest
# ============================================================================

# Default configuration
DEFAULT_REGION="europe-west4"
DEFAULT_GPU="nvidia-rtx-pro-6000"
DEFAULT_CPU=20
DEFAULT_MEMORY="80Gi"
DEFAULT_MIN_INSTANCES=0
DEFAULT_MAX_INSTANCES=3
DEFAULT_TIMEOUT="300s"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_header() {
    echo -e "${BLUE}============================================================================${NC}"
    echo -e "${BLUE}  $1${NC}"
    echo -e "${BLUE}============================================================================${NC}"
}

print_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Model configurations
declare -A MODEL_IMAGES=(
    ["musicgen-small"]="ghcr.io/facebookresearch/musicgen:small"
    ["musicgen-medium"]="ghcr.io/facebookresearch/musicgen:medium"
    ["musicgen-large"]="ghcr.io/facebookresearch/musicgen:large"
    ["stable-audio"]="ghcr.io/stability-ai/stable-audio-open:latest"
    ["mustango"]="ghcr.io/declare-lab/mustango:latest"
)

declare -A MODEL_PORTS=(
    ["musicgen-small"]="8080"
    ["musicgen-medium"]="8080"
    ["musicgen-large"]="8080"
    ["stable-audio"]="8080"
    ["mustango"]="8080"
)

declare -A MODEL_GPUS=(
    ["musicgen-small"]="nvidia-l4"
    ["musicgen-medium"]="nvidia-l4"
    ["musicgen-large"]="nvidia-rtx-pro-6000"
    ["stable-audio"]="nvidia-l4"
    ["mustango"]="nvidia-l4"
)

declare -A MODEL_MEMORY=(
    ["musicgen-small"]="32Gi"
    ["musicgen-medium"]="48Gi"
    ["musicgen-large"]="80Gi"
    ["stable-audio"]="32Gi"
    ["mustango"]="32Gi"
)

declare -A MODEL_CPU=(
    ["musicgen-small"]="8"
    ["musicgen-medium"]="12"
    ["musicgen-large"]="20"
    ["stable-audio"]="8"
    ["mustango"]="8"
)

show_help() {
    print_header "Lyria AI Studio - Cloud Run Deployment"
    echo ""
    echo "Usage: $0 [OPTIONS] [MODEL] [REGION]"
    echo ""
    echo "Models:"
    echo "  musicgen-small    MusicGen 300M params (~$504/month with L4)"
    echo "  musicgen-medium   MusicGen 1.5B params (~$504/month with L4)"
    echo "  musicgen-large    MusicGen 3.3B params (~$1,512/month with RTX Pro 6000)"
    echo "  stable-audio      Stable Audio Open 1.5B params (~$504/month with L4)"
    echo "  mustango          Mustango 1B params (~$504/month with L4)"
    echo ""
    echo "Regions (with GPU support):"
    echo "  us-central1       Iowa, USA (cheapest, most GPU availability)"
    echo "  europe-west4      Netherlands (EU data residency)"
    echo "  asia-northeast1   Tokyo, Japan"
    echo ""
    echo "Options:"
    echo "  --destroy         Delete the deployed service (requires MODEL and REGION)"
    echo "  --gpu TYPE        Override GPU type (default: based on model)"
    echo "  --cpu COUNT       Override CPU count (default: based on model)"
    echo "  --memory SIZE     Override memory (default: based on model)"
    echo "  --min-instances N Minimum instances (default: 0 for scale-to-zero)"
    echo "  --max-instances N Maximum instances (default: 3)"
    echo "  --dry-run         Show command without executing"
    echo "  --pricing         Show GPU pricing table"
    echo "  --help, -h        Show this help message"
    echo ""
    echo "Examples:"
    echo "  # Deploy"
    echo "  $0 musicgen-medium europe-west4"
    echo "  $0 musicgen-large us-central1 --gpu nvidia-a100-40gb"
    echo "  $0 stable-audio europe-west4 --dry-run"
    echo ""
    echo "  # Destroy"
    echo "  $0 --destroy musicgen-medium europe-west4"
    echo "  $0 --destroy stable-audio us-central1"
    echo ""
}

show_pricing() {
    print_header "GPU Pricing Reference (February 2026)"
    echo ""
    echo "┌─────────────────────┬──────┬────────┬────────────┬───────────────┐"
    echo "│ GPU Type            │ vCPU │ Memory │ GPU Memory │ \$/hour        │"
    echo "├─────────────────────┼──────┼────────┼────────────┼───────────────┤"
    echo "│ nvidia-l4           │  8   │  32GB  │    24GB    │  ~\$0.70/hr    │"
    echo "│ nvidia-rtx-pro-6000 │  20  │  80GB  │    48GB    │  ~\$2.10/hr    │"
    echo "│ nvidia-a100-40gb    │  12  │  85GB  │    40GB    │  ~\$3.67/hr    │"
    echo "│ nvidia-a100-80gb    │  12  │ 170GB  │    80GB    │  ~\$4.96/hr    │"
    echo "│ nvidia-h100-80gb    │  24  │ 340GB  │    80GB    │  ~\$8.50/hr    │"
    echo "└─────────────────────┴──────┴────────┴────────────┴───────────────┘"
    echo ""
    echo "Monthly estimates assume 24/7 running. Use min-instances=0 for pay-per-use."
    echo ""
}

destroy_service() {
    local model=$1
    local region=$2
    local service_name="lyria-${model}"
    
    print_header "Destroying Cloud Run Service"
    echo ""
    echo "  Service:  $service_name"
    echo "  Region:   $region"
    echo ""
    
    # Check if service exists
    if ! gcloud run services describe "$service_name" --region "$region" &>/dev/null; then
        print_warn "Service $service_name does not exist in region $region"
        exit 0
    fi
    
    # Confirm deletion
    read -p "Are you sure you want to delete $service_name in $region? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_warn "Deletion cancelled"
        exit 0
    fi
    
    # Delete the service
    print_info "Deleting service..."
    gcloud run services delete "$service_name" --region "$region" --quiet
    
    print_header "Service Deleted"
    echo ""
    print_info "Service $service_name has been deleted from $region"
    echo ""
}

# Parse arguments
DESTROY_MODE=false
MODEL=""
REGION=$DEFAULT_REGION
GPU=""
CPU=""
MEMORY=""
MIN_INSTANCES=$DEFAULT_MIN_INSTANCES
MAX_INSTANCES=$DEFAULT_MAX_INSTANCES
DRY_RUN=false

# Check for flags first
while [[ $# -gt 0 ]]; do
    case $1 in
        --destroy)
            DESTROY_MODE=true
            shift
            ;;
        --help|-h)
            show_help
            exit 0
            ;;
        --pricing)
            show_pricing
            exit 0
            ;;
        --gpu)
            GPU="$2"
            shift 2
            ;;
        --cpu)
            CPU="$2"
            shift 2
            ;;
        --memory)
            MEMORY="$2"
            shift 2
            ;;
        --min-instances)
            MIN_INSTANCES="$2"
            shift 2
            ;;
        --max-instances)
            MAX_INSTANCES="$2"
            shift 2
            ;;
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        -*)
            print_error "Unknown option: $1"
            show_help
            exit 1
            ;;
        *)
            # Positional arguments (MODEL and REGION)
            if [[ -z "$MODEL" ]]; then
                MODEL="$1"
            elif [[ -z "$REGION" ]] || [[ "$REGION" == "$DEFAULT_REGION" ]]; then
                REGION="$1"
            else
                print_error "Too many arguments: $1"
                show_help
                exit 1
            fi
            shift
            ;;
    esac
done

# Handle destroy mode
if [[ "$DESTROY_MODE" == true ]]; then
    if [[ -z "$MODEL" ]]; then
        print_error "MODEL is required for --destroy"
        show_help
        exit 1
    fi
    
    PROJECT=$(gcloud config get-value project 2>/dev/null)
    if [[ -z "$PROJECT" ]]; then
        print_error "No project set. Run: gcloud config set project YOUR_PROJECT_ID"
        exit 1
    fi
    
    print_info "Project: $PROJECT"
    destroy_service "$MODEL" "$REGION"
    exit 0
fi

# Validate model
if [[ -z "$MODEL" ]]; then
    show_help
    exit 1
fi

if [[ -z "${MODEL_IMAGES[$MODEL]}" ]]; then
    print_error "Unknown model: $MODEL"
    echo "Available models: ${!MODEL_IMAGES[@]}"
    exit 1
fi

# Set defaults based on model
IMAGE="${MODEL_IMAGES[$MODEL]}"
PORT="${MODEL_PORTS[$MODEL]}"
GPU=${GPU:-${MODEL_GPUS[$MODEL]}}
CPU=${CPU:-${MODEL_CPU[$MODEL]}}
MEMORY=${MEMORY:-${MODEL_MEMORY[$MODEL]}}
SERVICE_NAME="lyria-${MODEL}"

# Check prerequisites
print_header "Checking Prerequisites"

if ! command -v gcloud &> /dev/null; then
    print_error "gcloud CLI not found. Install from: https://cloud.google.com/sdk/docs/install"
    exit 1
fi
print_info "gcloud CLI found"

PROJECT=$(gcloud config get-value project 2>/dev/null)
if [[ -z "$PROJECT" ]]; then
    print_error "No project set. Run: gcloud config set project YOUR_PROJECT_ID"
    exit 1
fi
print_info "Project: $PROJECT"

# Check if APIs are enabled
print_info "Checking required APIs..."
REQUIRED_APIS=("run.googleapis.com" "artifactregistry.googleapis.com")
for api in "${REQUIRED_APIS[@]}"; do
    if ! gcloud services list --enabled --filter="name:$api" --format="value(name)" 2>/dev/null | grep -q "$api"; then
        print_warn "API $api not enabled. Enabling..."
        gcloud services enable "$api" --quiet
    fi
done
print_info "All required APIs enabled"

# Build deployment command
print_header "Deployment Configuration"
echo ""
echo "  Service:        $SERVICE_NAME"
echo "  Model:          $MODEL"
echo "  Image:          $IMAGE"
echo "  Region:         $REGION"
echo "  GPU:            $GPU"
echo "  CPU:            $CPU"
echo "  Memory:         $MEMORY"
echo "  Min Instances:  $MIN_INSTANCES"
echo "  Max Instances:  $MAX_INSTANCES"
echo ""

# Estimate cost
case $GPU in
    "nvidia-l4")
        HOURLY_COST="0.70"
        ;;
    "nvidia-rtx-pro-6000")
        HOURLY_COST="2.10"
        ;;
    "nvidia-a100-40gb")
        HOURLY_COST="3.67"
        ;;
    "nvidia-a100-80gb")
        HOURLY_COST="4.96"
        ;;
    "nvidia-h100-80gb")
        HOURLY_COST="8.50"
        ;;
    *)
        HOURLY_COST="unknown"
        ;;
esac

if [[ "$HOURLY_COST" != "unknown" ]]; then
    MONTHLY_COST=$(echo "$HOURLY_COST * 24 * 30" | bc)
    print_info "Estimated cost: ~\$$HOURLY_COST/hour (~\$$MONTHLY_COST/month if running 24/7)"
    if [[ "$MIN_INSTANCES" == "0" ]]; then
        print_info "Scale-to-zero enabled: You only pay when processing requests"
    fi
fi

# Build the gcloud command
DEPLOY_CMD="gcloud beta run deploy $SERVICE_NAME \
    --image $IMAGE \
    --port $PORT \
    --cpu $CPU \
    --memory $MEMORY \
    --gpu-type $GPU \
    --no-gpu-zonal-redundancy \
    --region $REGION \
    --min-instances $MIN_INSTANCES \
    --max-instances $MAX_INSTANCES \
    --timeout $DEFAULT_TIMEOUT \
    --allow-unauthenticated \
    --set-env-vars=\"MODEL_ID=$MODEL\""

print_header "Deployment Command"
echo ""
echo "$DEPLOY_CMD"
echo ""

if [[ "$DRY_RUN" == true ]]; then
    print_warn "DRY RUN: Command not executed"
    exit 0
fi

# Confirm deployment
read -p "Deploy $SERVICE_NAME to $REGION? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    print_warn "Deployment cancelled"
    exit 0
fi

# Execute deployment
print_header "Deploying..."
eval "$DEPLOY_CMD"

# Get service URL
SERVICE_URL=$(gcloud run services describe $SERVICE_NAME --region $REGION --format="value(status.url)")

print_header "Deployment Complete"
echo ""
print_info "Service URL: $SERVICE_URL"
print_info "Service Name: $SERVICE_NAME"
print_info "Region: $REGION"
echo ""
echo "To update Lyria AI Studio to use this endpoint:"
echo "  1. Open Settings in the app"
echo "  2. Set Custom Endpoint URL to: $SERVICE_URL"
echo ""
echo "To view logs:"
echo "  gcloud run logs read --service $SERVICE_NAME --region $REGION"
echo ""
echo "To delete the service:"
echo "  gcloud run services delete $SERVICE_NAME --region $REGION"
echo ""
