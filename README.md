Platform - GlassLab Game Services
========

Directory Structure
========
* The platform assumes the following other depos are running or in a particular director structure.
   * Create a directory called "hydra"
   * In the "hydra" directory clone the platform and all it's dependant repos below with the repository name being the same as the directory.
   * After all the repos have been clone "hydra" should contain
     * Assessment
     * Platform
     * Playfully.org
* Platform Directory
    * servers
        * server code and scripts
    * local
        * scripts for local development environment
    * scripts
        * scripts for deployment environment setup

Dependencies
========
* The platform depends on the following other depos:
    1. [Playfully.org](https://github.com/GlasslabGames/Playfully.org)
    2. [Assessment](https://github.com/GlasslabGames/Assessment)
        * The platform will send requests to the Assessment server on port 8003
        * The Assessment server will send requests to the Platform server on port 8002
        * The both ports should not be exposed to outside 

Setup/Install
========
See [servers](servers/README.md) docs

Custom Configs
========
See Configs in [servers](servers/README.md#configs) docs

