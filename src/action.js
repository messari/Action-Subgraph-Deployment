const core = require('@actions/core')
const github = require('@actions/github')
const DefaultMap = require('./DefaultMap');
const { runCommands } = require('./execute');

async function deploySubgraphs() {
    HOSTED_SERVICE_ACCESS_TOKEN = core.getInput('HOSTED_SERVICE_ACCESS_TOKEN')
    CHANGED_FILES = core.getInput('CHANGED_FILES').split(" ")
    ABSOLUTE_PATH = core.getInput('ABSOLUTE_PATH')
    GRAPH_DEPLOYMENT_LOCATION = core.getInput('GRAPH_DEPLOYMENT_LOCATION')

    let deployAny = 0
    let deployDirectory = new Set()
    let deployProtocol = new DefaultMap(() => new Set());
    let deployNetwork = new DefaultMap(() => new DefaultMap(() => new Set()));

    // Iterate through all changed files
    for (let i = 0; i < CHANGED_FILES.length; i++) {

        // If changed file is within a directory containing deployment code.
        if (CHANGED_FILES[i].includes("subgraphs/")) {

            let subgraphDir = CHANGED_FILES[i].split('subgraphs/')[1].split('/')[0]
            if (CHANGED_FILES[i].includes("/src/")) {

                let refFolder = CHANGED_FILES[i].split('/src/')[0].split('/').reverse()[1]
                // If src code is in common code folder for the directory
                if (refFolder.includes('subgraphs')) {
                    deployDirectory.add(subgraphDir)
                    deployAny=1
                } else if (refFolder.includes('protocols')) {

                    protocol = CHANGED_FILES[i].split('/src/')[0].split('/').reverse()[0]
                    deployProtocol.get(subgraphDir).add(protocol)
                    deployAny=1
                }
            } else if (CHANGED_FILES[i].includes("/config/")) {

                let refFolder = CHANGED_FILES[i].split('/config/')[0].split('/').reverse()[1]

                if (refFolder.includes('protocols')) {
                    let refFolder2 = CHANGED_FILES[i].split('/config/')[1].split('/')[0]

                    if (refFolder2.includes('networks')) {
                        let protocol = CHANGED_FILES[i].split('/config/')[0].split('/').reverse()[0]
                        let network = CHANGED_FILES[i].split('/config/')[1].split('/')[1]

                        deployNetwork.get(subgraphDir).get(protocol).add(network)
                        deployAny=1
                    }
                } else {
                    console.log("Warning: config/ folder should be located at subgraphs/**subgraph**/protocols/config/")
                }
            }
        }
    }

    // If a relevant file was changed, install dependencies and deploy subgraphs
    let scripts = []
    if (deployAny == 1) {
        scripts.push('npm install -g @graphprotocol/graph-cli')
        scripts.push('npm install --dev @graphprotocol/graph-ts')
        scripts.push('npm install mustache')
        scripts.push('npm install minimist')
        scripts.push('graph auth --product hosted-service ' + HOSTED_SERVICE_ACCESS_TOKEN)
        let dependenciesLength = scripts.length

        let directories =[]
        let protocols = []
        let networks = []

        // Deploy directories if relevant
        directories = Array.from(deployDirectory);
        for (let i = 0; i < directories.length; i++) {
            let path = ABSOLUTE_PATH + '/subgraphs/' + directories[i]
            scripts.push('npm --prefix ' + path + ' run -s deploy --SUBGRAPH=' + directories[i] + ' --LOCATION=' + GRAPH_DEPLOYMENT_LOCATION + ' --PRINTLOGS=true' + ' --MERGE=true')
        }

        // Deploy protocols if relevant
        directories = [...deployProtocol.keys()]
        for (let i = 0; i < directories.length; i++) {

            protocols = Array.from(deployProtocol.get(directories[i]));
            for (let j = 0; j < protocols.length; j++) {
                if (deployDirectory.has(directories[i]) == false) {
                    let path = ABSOLUTE_PATH + '/subgraphs/' + directories[i]
                    scripts.push('npm --prefix ' + path + ' run -s deploy --SUBGRAPH=' + directories[i] + ' --PROTOCOL=' +  protocols[j] + ' --LOCATION=' + GRAPH_DEPLOYMENT_LOCATION + ' --PRINTLOGS=true' + ' --MERGE=true')
                }
            }
        }

        // Deploy protocol/networks if relevant
        directories = [...deployNetwork.keys()];
        for (let i = 0; i < directories.length; i++) {
            protocols = [...deployNetwork.get(directories[i]).keys()];
            for (let j = 0; j < protocols.length; j++) {
                networks = Array.from(deployNetwork.get(directories[i]).get(protocols[j]));
                for (let k = 0; k < networks.length; k++) {
                    if (deployDirectory.has(directories[i]) == false) {
                        if (deployProtocol.has(directories[i]) == false | (deployProtocol.has(directories[i]) == true & deployProtocol.get(directories[i]).has(protocols[j]) == false)) {
                            let path = ABSOLUTE_PATH + '/subgraphs/' + directories[i]
                            scripts.push('npm --prefix ' + path + ' run -s deploy --SUBGRAPH=' + directories[i] + ' --PROTOCOL=' + protocols[j] + ' --NETWORK=' + networks[k] + ' --LOCATION=' + GRAPH_DEPLOYMENT_LOCATION + ' --PRINTLOGS=true' + ' --MERGE=true')
                        }
                    }
                }
            }
        }

    console.log("Running scripts: ")
    console.log(scripts)
    runCommands(scripts, dependenciesLength, function(deployments) {})
    }
}

deploySubgraphs();