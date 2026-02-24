from setuptools import setup, find_packages

setup(
    name="verifair-analysis-engine",
    version="1.0.0",
    description="Standalone bias detection engine for Verifair — pip-installable for CLI, Slack bots, ETL pipelines",
    packages=find_packages(),
    install_requires=[
        "httpx",
    ],
    python_requires=">=3.8",
)
