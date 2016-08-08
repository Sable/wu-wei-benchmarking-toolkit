Usage: install [<dependency-source> or <sub-directory>] [options]

Copy and install the dependency from <dependency-source> into the repository or recursively install all dependencies from <sub-directory>. If no <dependency-source> or <sub-directory> is provided, 
<sub-directory> defaults to the current directory.

<dependency-source> can be:
    <file> or <url> to a Wu-Wei artifact file (ex: path/to/experiment.json)
    <directory> to a Wu-Wei artifact outside of the repository
    <file> or <url> to a zip or tarball archive (ex: http://site.ext/archive.tar.gz)
    <git> repository (ex: git@github.com:Sable/babai-benchmark)

A <dependency-source> may or may not contain a Wu-Wei artifact.

<sub-directory> must be a sub-directory of the current repository.

Options:
    --clear-cache        Remove all cached remote dependencies
    --compatibilities    Install also dependencies listed in the 'compatibilities' property
    --destination, -d    Destination of the dependency. Optional for Wu-Wei artifacts,
                         mandatory otherwise.
    --dry-run            Fetch dependencies recursively but skip installation and copy
    				     to their final destination
    --help, -h           Display this help.
    --not-recursive      Skip the dependency's recursive dependencies.
    --root, -r           Benchmark suite root.
    --short-name, -s     (Optional) Short-name to use for the Wu-Wei artifact 
                         <dependency-source> after installation.
    --type, -t           (Optional) Type of the dependency (Wu-Wei artifact type 
                         (ex:  benchmark) or 'file' otherwise).
    --verbose, -v        Display more information when executing.

Examples:


    $ wu install 
    $ wu install .

Installs all dependencies within the current directory and subdirectories.


    $ wu install ./benchmarks/backprop 

Installs all dependencies within the backprop benchmark directory.


    $ wu install ./experiments/foo/experiment.json

Installs all dependencies of the 'foo' experiment.


    $ wu install https://website.com/experiment.json

Creates a new artifact directory for 'experiment.json' under the 
'experiments/<short-name>' directory of the Wu-Wei repository, and install all its dependencies.


    $ wu install experiment.zip
    $ wu install http://website.com/experiment.zip

If 'experiment.zip contains an archive of a Wu-Wei artifact, copies the artifact into the repository
and install all its dependencies. Otherwise, do nothing.


    $ wu install ../<path-to-outside-directory>/backprop-benchmark/

If 'backprop-benchmark' contains a Wu-Wei artifact, copies the artifact into the repository
and install all its dependencies. Otherwise, do nothing.