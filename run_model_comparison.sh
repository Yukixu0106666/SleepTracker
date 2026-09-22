#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"

# Use project-local dependencies when present, without changing global Python.
if [ -d .analysis-deps ]; then
    export PYTHONPATH="$PWD/.analysis-deps${PYTHONPATH:+:$PYTHONPATH}"
fi
# On macOS, reuse sklearn's bundled OpenMP runtime if available.
if [ "$(uname -s)" = Darwin ]; then
    analysis_omp_dir="$(python3 -c 'from pathlib import Path; import sklearn; print(Path(sklearn.__file__).parent / ".dylibs")')"
    if [ -f "$analysis_omp_dir/libomp.dylib" ]; then
        export DYLD_LIBRARY_PATH="$analysis_omp_dir${DYLD_LIBRARY_PATH:+:$DYLD_LIBRARY_PATH}"
    fi
fi
exec python3 sleep_model_comparison.py "$@"
