from setuptools import setup, find_packages

setup(
    name="eidos-client",
    version="3.0.0",
    description="Official Python client SDK for Eidos Semantic Recommendation & Vector Search Engine",
    author="Eidos Engineering Team",
    packages=find_packages(include=["eidos", "eidos.*"]),
    python_requires=">=3.8",
    install_requires=[],
    extras_require={
        "dev": ["pytest>=7.0"],
    },
    classifiers=[
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.8",
        "Programming Language :: Python :: 3.9",
        "Programming Language :: Python :: 3.10",
        "Programming Language :: Python :: 3.11",
        "Programming Language :: Python :: 3.12",
        "License :: OSI Approved :: MIT License",
        "Topic :: Scientific/Engineering :: Artificial Intelligence",
    ],
)
