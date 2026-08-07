ifeq ($(OS),Windows_NT)
    PYTHON = venv\Scripts\python.exe
    PIP = venv\Scripts\pip.exe
    PYTEST = venv\Scripts\pytest.exe
else
    PYTHON = ./venv/bin/python
    PIP = ./venv/bin/pip
    PYTEST = ./venv/bin/pytest
endif

.PHONY: setup setup-advanced test run-agent train

setup:
	python -m venv venv
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

//Linux and MacOS

.PHONY: setup setup-advanced test run-agent train

setup:
	python3 -m venv venv
	./venv/bin/pip install --upgrade pip
	./venv/bin/pip install -r requirements.txt

setup-advanced:
	./venv/bin/pip install -r requirements-advanced.txt

test:
	./venv/bin/pytest -v

train:
	./venv/bin/python scripts/train_baseline.py

run-agent:
	./venv/bin/python -m src.agent.chatbot
