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
