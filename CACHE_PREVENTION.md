# Preventing Python Cache Issues

## The Problem

Python compiles `.py` files into bytecode (`.pyc` files) and stores them in `__pycache__` directories for faster loading. When you change `config.py`, Python might still use the old cached version, causing your changes to be ignored.

## Solutions

### ✅ Solution 1: Automatic Cache Clearing (IMPLEMENTED)

The `run_worker.bat` script now **automatically clears the cache** every time you run it. This ensures your config changes are always applied.

**What was added:**
```batch
echo [INFO] Clearing Python cache...
if exist "worker\__pycache__" rmdir /s /q "worker\__pycache__"
if exist "worker\core\__pycache__" rmdir /s /q "worker\core\__pycache__"
if exist "worker\services\__pycache__" rmdir /s /q "worker\services\__pycache__"
if exist "worker\sort\__pycache__" rmdir /s /q "worker\sort\__pycache__"
```

**Usage:** Just run `.\run_worker.bat` as normal - cache clearing happens automatically!

---

### ✅ Solution 2: Manual Cache Clearing Script

A standalone script `clear_cache.bat` has been created for manual cache clearing.

**Usage:**
```powershell
.\clear_cache.bat
```

**When to use:** If you're running the worker directly with `python worker\main.py` instead of using the batch file.

---

### 🔧 Solution 3: Disable Python Bytecode Compilation (Optional)

You can tell Python to never create `.pyc` files by setting an environment variable.

**Add to your `.venv\Scripts\activate.bat`:**
```batch
set PYTHONDONTWRITEBYTECODE=1
```

**Or run before starting the worker:**
```powershell
$env:PYTHONDONTWRITEBYTECODE=1
.\run_worker.bat
```

**Pros:** No cache files created, changes always apply  
**Cons:** Slightly slower startup time (negligible for this project)

---

### 🔧 Solution 4: Use Python's `-B` Flag (Alternative)

Modify `run_worker.bat` to use the `-B` flag:

```batch
python -B worker\main.py %*
```

This tells Python to not write bytecode files.

---

## Recommended Approach

**Use Solution 1 (Automatic Cache Clearing)** - It's already implemented in your `run_worker.bat`!

This gives you the best of both worlds:
- ✅ Fast startup (Python can still use cache between runs)
- ✅ Config changes always apply (cache is cleared before each run)
- ✅ No manual intervention needed

---

## Quick Reference

| Scenario | Solution |
|----------|----------|
| Running with `.\run_worker.bat` | ✅ Automatic - nothing to do! |
| Running with `python worker\main.py` | Run `.\clear_cache.bat` first |
| Changes not applying | Check if you saved the file, then re-run |
| Want to disable cache permanently | Set `PYTHONDONTWRITEBYTECODE=1` |

---

## Testing the Fix

Try changing the config and running the worker:

1. Edit `worker\config.py` - change `VIDEO_SOURCE` to a different video
2. Save the file
3. Run `.\run_worker.bat`
4. ✅ The new video should be used immediately!

The cache clearing message will appear in the output:
```
[INFO] Clearing Python cache...
[INFO] Starting Worker...
```
