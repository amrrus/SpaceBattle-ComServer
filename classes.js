var _ = require('lodash');
var exec = require('child_process').exec;

class Room {

    constructor(bp = null, tp = null, serv = null) {
        this.config = null;    
        this.players = [bp, tp];
        this.server = serv;
    }

    getPlayers() {
        return this.players;
    }

    getServer() {
        return this.server;
    }

    setServer(server) {
        this.server = server;
    }

    hasServer() {
        return !_.isNull(this.getServer());
    }

    hasPlayer(idPlayer) {
        return _.includes(this.getPlayers(), idPlayer);
    }

    addPlayer(id, pos = null) { // pos (position) => null/0/1
        var index = -1;
        if (_.isUndefined(this.getPlayers()[pos])){
            index = _.indexOf(this.getPlayers(), null);
        }

        if (_.isNull(this.getPlayers()[index])) {
            this.players[index] = id;
            return index;
        } else {
            return -1;
        }
    }

    removePlayer(pos){
        this.players[pos] = null;
    }

    getPlayerPosition(id) {
        return _.indexOf(this.getPlayers(), id);
    }

    setConfig(config) {
        this.config = config;
    }

    initServer(){
        this.serverExecution = exec('java -cp "physicsServer.jar" physics_server.Main', (err, stdout, stderr) => {
            console.log(err);
            console.log(stdout);
            console.log(stderr);
            if (err)
                console.log(err);
            else
                console.log("java running")
        })
    }
    stopServer(){
        console.log("Stop server")        
        // TODO: NO FUNCIONA (NO SE MATA EL PROCESO)
        this.serverExecution.stdin.pause();
        this.serverExecution.kill();
    }
}

module.exports.Room = Room;