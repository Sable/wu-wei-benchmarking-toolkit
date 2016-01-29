Wu Wei (無爲) Benchmarking Toolkit
==========================

Wu wei (*[non-effort](//https://en.wikipedia.org/wiki/Wu_wei)*) is a benchmarking toolkit developed in the [Sable Lab](http://www.sable.mcgill.ca/) at [McGill University](//www.mcgill.ca/) with the objective of simplifying the study of languages and tools used for numerical computing.

We aim to make the toolkit be:
 1. **Consistent** and **Correct** by supporting correctness checks for every language implementation of benchmarks that automatically ensure that the computation result of the benchmarks are consistent across all language implementations and correct with regard to the algorithm for known inputs;
 2. **Extensible** across numerical languages, benchmarks, compilers, run-time environments;
 3. **Friendly to language implementation research** by automating all tasks for compiler and virtual-machine research and encouraging a writing style for benchmarks that factors the core computation from the runners to minimize the non-core functions necessary to validate the output of compilers;
 4. **Easy to use** by automating the deployment of benchmarks, their test on virtual (web browser and others) and native platforms, as well as the gathering and reporting of relative performance data;
 5. **Fast** by making the setup (data generation and loading) and teardown as quick as possible so that most of the time is spent in the core computation in every language;
 6. **Small** by minimizing the amount of data needed to use the suite;
 7. **Simple** by minimizing the amount of external dependencies and tools required to run the suite;
 
Dependencies
------------------------
Although we tried our best to minimize external dependencies, the suite still depends on the following external tools:
 1. Node.js

Getting Started
------------------------
Please [read our wiki](../../wiki) for more details on obtaining the toolkit and how to add benchmarks, compilers, and environments to use.

Copyright and License
-------------------------
Copyright (c) 2016, Erick Lavoie, Laurie Hendren and McGill University.

- Ostrich: [MIT Licence](LICENSE)
- OpenDwarfs: [GNU Lesser General Public License](//github.com/opendwarfs/OpenDwarfs/blob/master/LICENSE)
- Rodinia: [Rodinia Licence](//www.cs.virginia.edu/~sc5nf/license.htm)
- V8: [BSD 3 Licence](//developers.google.com/v8/terms)
