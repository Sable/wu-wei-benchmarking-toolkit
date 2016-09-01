Wu-Wei (無爲) Benchmarking Toolkit
==========================

[![Join the chat at https://gitter.im/Sable/wu-wei-benchmarking-toolkit](https://badges.gitter.im/Sable/wu-wei-benchmarking-toolkit.svg)](https://gitter.im/Sable/wu-wei-benchmarking-toolkit?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge) [![Build Status](https://travis-ci.org/Sable/wu-wei-benchmarking-toolkit.svg?branch=master)](https://travis-ci.org/Sable/wu-wei-benchmarking-toolkit)

Wu-Wei (*[non-effort](https://en.wikipedia.org/wiki/Wu_wei)*) is a benchmarking toolkit developed in the [Sable Lab](http://www.sable.mcgill.ca/) at [McGill University](//www.mcgill.ca/) with the objective of simplifying the study of the performance of programming languages implementations and tools.

We aim to make the toolkit and the benchmark suites built with it:
 1. **Consistent** and **Correct** by supporting correctness checks for every language implementation of benchmarks that automatically ensure that the computation result of the benchmarks are consistent across all language implementations and correct with regard to the algorithm for known inputs;
 2. **Extensible** across numerical languages, benchmarks, compilers, run-time environments;
 3. **Friendly to language implementation research** by automating all tasks for compiler and virtual-machine research and encouraging a writing style for benchmarks that factors the core computation from the runners to minimize the non-core functions necessary to validate the output of compilers;
 4. **Easy to use** by automating the deployment of benchmarks, their test on virtual (web browser and others) and native platforms, as well as the gathering and reporting of relative performance data;
 5. **Fast** by making the setup (data generation and loading) and teardown as quick as possible so that most of the time is spent in the core computation in every language;
 6. **Small** by minimizing the amount of data needed to use the suite;
 7. **Simple** by minimizing the amount of external dependencies and tools required to run the suite;
 
Dependencies
------------------------
Although we tried our best to minimize external dependencies, the toolkit still depends on the following external tools:
 1. Node.js
 2. Python

Individual artifacts may have more dependencies. Refer to their documentation for more details.

Getting Started
------------------------
Please read [the handbook](https://github.com/Sable/wu-wei-handbook) for more details on how to use it.

Copyright and License
-------------------------
Copyright (c) 2016, Erick Lavoie, Hanfeng Chen
