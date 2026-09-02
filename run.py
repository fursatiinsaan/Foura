#!/usr/bin/env python3
"""
Foura Unified Launcher
Usage: python3 run.py
"""
import subprocess
import sys
import os
import signal

def main():
    root = os.path.dirname(os.path.abspath(__file__))
    start_sh = os.path.join(root, "start.sh")
    
    try:
        subprocess.run(["bash", start_sh], check=True)
    except KeyboardInterrupt:
        print("\n[Foura] Gracefully shutting down...")
        sys.exit(0)
    except Exception as e:
        print(f"\n[Foura] Error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
