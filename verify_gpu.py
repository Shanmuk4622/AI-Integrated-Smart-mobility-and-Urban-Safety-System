import torch
import sys

try:
    print(f"Python Version: {sys.version}")
    print(f"PyTorch Version: {torch.__version__}")
    cuda_available = torch.cuda.is_available()
    print(f"CUDA Available: {cuda_available}")
    if cuda_available:
        print(f"Testing GPU Device: {torch.cuda.get_device_name(0)}")
        t = torch.tensor([1, 2, 3]).cuda()
        print(f"Tensor on GPU: {t.device}")
    else:
        print("WARNING: Running on CPU.")
except ImportError as e:
    print(f"Import Error: {e}")
except Exception as e:
    print(f"Error: {e}")
