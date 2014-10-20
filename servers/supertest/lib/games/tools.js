// The function of this helper script is to pull achievements and sowo from definining documents.
function achieve(gameId) {
  return require('../../../lib/dash/games/' + gameId.toLowerCase() + '/achievements.json');  
}

module.exports = {
  achieve: achieve
}
