# Cross-platform task runner. The ifeq below is what makes this work on
# both Windows and POSIX from a single set of targets — SYS_PYTHON is the
# interpreter used to *create* the venv (python on Windows, python3 on
# Linux/macOS), while PYTHON/PIP/PYTEST point inside the created venv.
ifeq ($(OS),Windows_NT)
    SYS_PYTHON = python
    PYTHON = venv\Scripts\python.exe
    PIP = venv\Scripts\pip.exe
    PYTEST = venv\Scripts\pytest.exe
else
    SYS_PYTHON = python3
    PYTHON = ./venv/bin/python
    PIP = ./venv/bin/pip
    PYTEST = ./venv/bin/pytest
endif

.PHONY: setup setup-advanced test run-agent train

setup:
	$(SYS_PYTHON) -m venv venv
	$(PIP) install --upgrade pip
	$(PIP) install -r requirements.txt

setup-advanced:
	$(PIP) install -r requirements-advanced.txt

test:
	$(PYTEST) -v

train:
	$(PYTHON) scripts/train_baseline.py

run-agent:
	$(PYTHON) -m src.agent.chatbot
