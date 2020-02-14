const isMutant = (dna) => {
    const countItem = {
        arriba: 0,
        izquierda: 0,
        arriba_izquierda: 0,
        arriba_derecha: 0,
    }

    var count
    var result = false;
    const largoRepetidos = 3;
    count = new Array(dna.length)
    for(var i = 0 ; result === false && i <  dna.length; i++) {
        count[i] = new Array(dna[i].length)
        for(var j = 0; result === false && j < dna[i].length; j++) {
            count[i][j] = Object.assign({}, countItem)

            if(i > 0) {
                count[i][j].arriba = dna[i][j] === dna[i-1][j]? 
                    count[i-1][j].arriba+1 : 
                    0
                result = count[i][j] 
                if(j > 0) {
                    count[i][j].arriba_izquierda = dna[i][j] === dna[i-1][j-1]? 
                        count[i-1][j-1].arriba_izquierda+1 : 
                        0
                }
                if(j < dna[i-1].length - 1) {
                    count[i][j].arriba_derecha = dna[i][j] === dna[i-1][j+1]? 
                        count[i-1][j+1].arriba_derecha+1 : 
                        0
                }
            }
            if(j > 0) {
                count[i][j].izquierda = dna[i][j] === dna[i][j-1]? 
                    count[i][j-1].izquierda+1 : 
                    0
            }
            result = (count[i][j].arriba === largoRepetidos) ||
                (count[i][j].arriba_derecha === largoRepetidos) ||
                (count[i][j].arriba_izquierda === largoRepetidos) ||
                (count[i][j].izquierda === largoRepetidos)
        }
    }
    return result;
}

exports.isMutant = isMutant

// console.log(isMutant(["ATGCGA", "CAGTGC", "TTATGT", "AGAAGG", "CCCCTA", "TCACTG"]))
// console.log(isMutant(["ATGCGA", "CAGTGC", "TTATTT", "AGACGG", "GCGTCA", "TCACTG"]))