.PHONY: venv install seed dev

venv:
	python3 -m venv .venv

install:
	.venv/bin/pip install -r requirements.txt

seed:
	.venv/bin/python seed.py

dev:
	.venv/bin/uvicorn app.main:app --reload --port 8000
