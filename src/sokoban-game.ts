const template = document.createElement('template');
template.innerHTML = `
<style>
:host {
    display: block;
    background: white;
}

.meta {

}

canvas {
    border: 3px solid brown;
    height: 100%;
    width: 100%;
}

</style>
<div class="meta">
    <span>Level: <span id="level">1</span></span>
    <span>Aantal stappen: <span id="aantal-stappen">0</span></span>
    <button id="level-opnieuw-beginnen">Level opnieuw beginnen</button>
    <button id="zet-ongedaan-maken">Zet ongedaan maken</button>
</div>
<canvas tabindex="1"></canvas>
`;

type Level = {
    readonly breedte: number,
    readonly level: string
};

type Positie = {
    readonly kolom: number,
    readonly rij: number,
}

// http://www.sokobano.de/wiki/index.php?title=Level_format
enum Veld {
    Leeg = ' ',
    Speler = '@',
    SpelerOpLeegDoel = '+',
    LeegDoel = '.',
    KratOpDoel = '*',
    Krat = '$',
    Muur = '#'
}

// We kunnen de acties documenteren
// Zie ook http://www.sokobano.de/wiki/index.php?title=Level_format#Solution
enum Actie {
    Omhoog = 'u',
    OmhoogDuwen = 'U',
    NaarRechts = 'r',
    NaarRechtsDuwen = 'R',
    Omlaag = 'd',
    OmlaagDuwen = 'D',
    NaarLinks = 'l',
    NaarLinksDuwen = 'L',
}

const levels: Record<number, Level> = {
    1: {
        breedte: 19,
        level: '    #####              #   #              #$  #            ###  $##           #  $ $ #         ### # ## #   #######   # ## #####  ..## $  $          ..###### ### #@##  ..#    #     #########    #######        ',
    },
    2: {
        breedte: 14,
        level: '############  #..  #     ####..  # $  $  ##..  #$####  ##..    @ ##  ##..  # #  $ ######## ##$ $ #  # $  $ $ $ #  #    #     #  ############'
    }
};

export class SokobanComponent extends HTMLElement {
    private canvas: HTMLCanvasElement;
    private context: CanvasRenderingContext2D;
    private canvasWidth: number;
    private canvasHeight: number;

    private staat: string;
    private breedte: number;

    private level: number = 1;
    private aantalStappen: number = 0;
    private stappen: string = '';

    constructor() {
        super();

        // Create shadow DOM based on template
        this.attachShadow({ mode: 'open'})
            .append(template.content.cloneNode(true));

        this.canvas = this.shadowRoot.querySelector('canvas');
    }

    public connectedCallback() {
        // called when the component is added to the DOM
        this.initializeCanvas();

        this.beginLevel(this.level);

        // Add event listeners
        window.addEventListener('keydown', this.opToetsGedrukt.bind(this));
        this.shadowRoot.querySelector('#level-opnieuw-beginnen').addEventListener('click', () => this.beginLevel(this.level));
        this.shadowRoot.querySelector('#zet-ongedaan-maken').addEventListener('click', () => this.laatsteZetOngedaanMaken());
        window.addEventListener('resize', (event) => {
            this.initializeCanvas();
            this.teken();
        });

        this.focus();
    }

    private beginLevel(nummer: number): void {
        this.level = nummer;
        const level = this.leesLevel(this.level);
        this.staat = level.level;
        this.breedte = level.breedte;
        this.aantalStappen = 0;

        this.teken();
    }

    private initializeCanvas(): void {
        // https://www.html5rocks.com/en/tutorials/canvas/hidpi/
        // Get the device pixel ratio, falling back to 1.
        const dpr = window.devicePixelRatio || 1;
        // Get the size of the canvas in CSS pixels.
        const rect = this.canvas.getBoundingClientRect();
        this.canvasWidth = rect.width;
        this.canvasHeight = rect.height;
        // Give the canvas pixel dimensions of their CSS
        // size * the device pixel ratio.
        this.canvas.width = rect.width * dpr;
        this.canvas.height = rect.height * dpr;
        this.context = this.canvas.getContext('2d');
        // Scale all drawing operations by the dpr, so you
        // don't have to worry about the difference.
        this.context.scale(dpr, dpr);
    }

    private leesLevel(level: number): Level {
        return levels[level];
    }

    private teken(): void {
        // Maak het tekenveld leeg
        this.context.clearRect(0, 0, this.canvasWidth, this.canvasHeight);

        // Stel level en aantal stappen in
        this.shadowRoot.querySelector('#level').innerHTML = this.level.toString();
        this.shadowRoot.querySelector('#aantal-stappen').innerHTML = this.aantalStappen.toString();

        const aantalRijen = this.staat.length / this.breedte;
        const aantalKolommen = this.breedte;

        const grootte = Math.min(
            Math.floor(this.canvasWidth / aantalKolommen),
            Math.floor(this.canvasHeight / aantalRijen)
        );

        // Bereken waar we beginnen met tekenen
        const beginKolom = Math.floor((this.canvasWidth - (aantalKolommen * grootte)) / 2);
        const beginRij = Math.floor((this.canvasHeight - (aantalRijen * grootte)) / 2);

        for (let rij = 0; rij < aantalRijen; rij++) {
            for (let kolom = 0; kolom < aantalKolommen; kolom++) {
                const positie = this.watZitErOpPositie(kolom, rij);

                switch(positie) {
                    case Veld.Speler:
                    case Veld.SpelerOpLeegDoel:
                        this.context.fillStyle = 'rgba(255, 0, 0, 1)';
                        break;
                    case Veld.Krat:
                        this.context.fillStyle = 'rgba(0, 255, 0, 1)';
                        break;
                    case Veld.LeegDoel:
                        this.context.fillStyle = 'rgba(0, 0, 255, 1)';
                        break;
                    case Veld.KratOpDoel:
                        this.context.fillStyle = 'rgba(255, 0, 255, 1)';
                        break;
                    default:
                        this.context.fillStyle = 'rgba(0, 0, 0, 1)';
                }

                if (positie === Veld.Leeg) continue;

                this.context.fillRect(beginKolom + (kolom * grootte), beginRij + (rij * grootte), grootte, grootte);
            }
        }
    }

    private watZitErOpPositie(kolom: number, rij: number): string {
        return this.staat[rij * this.breedte + kolom];
    }

    private zetOpPositie(kolom: number, rij: number, waarde: string): void {
        const arr = [...this.staat];
        arr[rij * this.breedte + kolom] = waarde;

        this.staat = arr.join('');
    }

    private waarIsDeSpeler(): Positie {
        const positie = this.staat.indexOf(Veld.Speler) >= 0
            ? this.staat.indexOf(Veld.Speler)
            : this.staat.indexOf(Veld.SpelerOpLeegDoel);
        return {
            rij: Math.floor(positie / this.breedte),
            kolom: positie % this.breedte
        };
    }

    private opToetsGedrukt(event: KeyboardEvent): void {
        if (!['ArrowUp', 'ArrowRight', 'ArrowDown', 'ArrowLeft'].includes(event.key)) {
            return
        }

        event.preventDefault();
        if (event.key === 'ArrowUp') {
            this.beweegNaar(0, -1, Actie.Omhoog);
        }
        if (event.key === 'ArrowDown') {
            this.beweegNaar(0, +1, Actie.Omlaag);
        }
        if (event.key === 'ArrowLeft') {
            this.beweegNaar(-1, 0, Actie.NaarLinks);
        }
        if (event.key === 'ArrowRight') {
            this.beweegNaar(+1, 0, Actie.NaarRechts);
        }
    }

    private isHetLevelOpgelost(): boolean {
        const aantalRijen = this.staat.length / this.breedte;
        for(let rij = 0; rij < aantalRijen; rij++) {
            for (let kolom = 0; kolom < this.breedte; kolom++) {
                const veld = this.watZitErOpPositie(kolom, rij);
                if (veld === Veld.Krat) {
                    return false;
                }
            }
        }

        return true;
    }

    private beweegNaar(kolomRichting: number, rijRichting: number, actie: string): void {
        const { kolom, rij } = this.waarIsDeSpeler();

        const waarDeSpelerStond = this.watZitErOpPositie(kolom, rij) === Veld.SpelerOpLeegDoel ? Veld.LeegDoel : Veld.Leeg;

        const volgende = this.watZitErOpPositie(kolom + kolomRichting, rij + rijRichting);
        if (volgende === Veld.Leeg || volgende === Veld.LeegDoel) {
            this.telEenStap(actie);
            this.zetOpPositie(kolom + kolomRichting, rij + rijRichting, volgende === Veld.Leeg ? Veld.Speler : Veld.SpelerOpLeegDoel);
            this.zetOpPositie(kolom, rij, waarDeSpelerStond);
        } else if (volgende === Veld.Krat || volgende === Veld.KratOpDoel) {
            const daaropvolgende = this.watZitErOpPositie(kolom + (kolomRichting * 2), rij + (rijRichting * 2));
            if (daaropvolgende === Veld.Leeg || daaropvolgende === Veld.LeegDoel) {
                this.telEenStap(actie.toUpperCase());
                this.zetOpPositie(kolom + (kolomRichting * 2), rij + (rijRichting * 2), daaropvolgende === Veld.Leeg ? Veld.Krat : Veld.KratOpDoel);
                this.zetOpPositie(kolom + kolomRichting, rij + rijRichting, volgende === Veld.Krat ? Veld.Speler : Veld.SpelerOpLeegDoel);
                this.zetOpPositie(kolom, rij, waarDeSpelerStond);
            }
        }

        this.teken();

        if (this.isHetLevelOpgelost()) {
            if (Object.keys(levels).includes((this.level + 1).toString()) === false) {
                if (window.confirm('Je hebt alle levels opgelost. Gefeliciteerd! Klik op OK om weer bij level 1 te beginnen. Of annuleren om dit level opnieuw te starten.')) {
                    this.beginLevel(1);
                } else {
                    this.beginLevel(this.level);
                }
                return;
            }

            if (window.confirm('You win! Wil je naar het volgende level?')) {
                // Ga naar het volgende level
                this.beginLevel(this.level + 1);
            } else {
                // start dit level opnieuw.
                this.beginLevel(this.level);
            }
        }
    }

    private telEenStap(actie: string): void {
        this.stappen = this.stappen + actie;
        this.aantalStappen = this.aantalStappen + 1;
        this.shadowRoot.querySelector('#aantal-stappen').innerHTML = this.aantalStappen.toString();
    }

    private laatsteZetOngedaanMaken(): void {
        if (this.stappen.length === 0) {
            // we hebben nog helemaal geen stappen gezet!
            return;
        }

        const { kolom, rij } = this.waarIsDeSpeler();
        const waarDeSpelerStond = this.watZitErOpPositie(kolom, rij) === Veld.SpelerOpLeegDoel ? Veld.LeegDoel : Veld.Leeg;
        const waarHetKratKomt = this.watZitErOpPositie(kolom, rij) === Veld.SpelerOpLeegDoel ? Veld.KratOpDoel : Veld.Krat;

        const laatsteActie = this.stappen.charAt(this.stappen.length - 1);

        let volgende: string;
        switch (laatsteActie) {
            case Actie.Omhoog:
                // Zet een stap naar beneden
                volgende = this.watZitErOpPositie(kolom, rij + 1);
                this.zetOpPositie(kolom, rij, waarDeSpelerStond);
                this.zetOpPositie(kolom, rij + 1, volgende === Veld.LeegDoel ? Veld.SpelerOpLeegDoel : Veld.Speler);
                break;
            case Actie.OmhoogDuwen:
                // Zet een stap naar beneden en trek het krat mee terug
                volgende = this.watZitErOpPositie(kolom, rij + 1);
                this.zetOpPositie(kolom, rij + 1, volgende === Veld.LeegDoel ? Veld.SpelerOpLeegDoel : Veld.Speler);
                this.zetOpPositie(kolom, rij, waarHetKratKomt);
                this.zetOpPositie(kolom, rij - 1, this.watZitErOpPositie(kolom, rij - 1) === Veld.KratOpDoel ? Veld.LeegDoel : Veld.Leeg);
                break;
            case Actie.Omlaag:
                // Zet een stap omhoog
                volgende = this.watZitErOpPositie(kolom, rij - 1);
                this.zetOpPositie(kolom, rij, waarDeSpelerStond);
                this.zetOpPositie(kolom, rij - 1, volgende === Veld.LeegDoel ? Veld.SpelerOpLeegDoel : Veld.Speler);
                break;
            case Actie.OmlaagDuwen:
                // Zet een stap naar boven en trek het krat mee terug
                volgende = this.watZitErOpPositie(kolom, rij - 1);
                this.zetOpPositie(kolom, rij - 1, volgende === Veld.LeegDoel ? Veld.SpelerOpLeegDoel : Veld.Speler);
                this.zetOpPositie(kolom, rij, waarHetKratKomt);
                this.zetOpPositie(kolom, rij + 1, this.watZitErOpPositie(kolom, rij + 1) === Veld.KratOpDoel ? Veld.LeegDoel : Veld.Leeg);
                break;
            case Actie.NaarLinks:
                // Zet een stap naar rechts
                volgende = this.watZitErOpPositie(kolom + 1, rij);
                this.zetOpPositie(kolom, rij, waarDeSpelerStond);
                this.zetOpPositie(kolom + 1, rij, volgende === Veld.LeegDoel ? Veld.SpelerOpLeegDoel : Veld.Speler);
                break;
            case Actie.NaarLinksDuwen:
                // Zet een stap naar rechts en trek het krat mee terug
                volgende = this.watZitErOpPositie(kolom + 1, rij);
                this.zetOpPositie(kolom + 1, rij, volgende === Veld.LeegDoel ? Veld.SpelerOpLeegDoel : Veld.Speler);
                this.zetOpPositie(kolom, rij, waarHetKratKomt);
                this.zetOpPositie(kolom - 1, rij, this.watZitErOpPositie(kolom - 1, rij) === Veld.KratOpDoel ? Veld.LeegDoel : Veld.Leeg);
                break;
            case Actie.NaarRechts:
                // Zet een stap naar links
                volgende = this.watZitErOpPositie(kolom - 1, rij);
                this.zetOpPositie(kolom, rij, waarDeSpelerStond);
                this.zetOpPositie(kolom - 1, rij, volgende === Veld.LeegDoel ? Veld.SpelerOpLeegDoel : Veld.Speler);
                break;
            case Actie.NaarRechtsDuwen:
                // Zet een stap naar links en trek het krat mee terug
                volgende = this.watZitErOpPositie(kolom - 1, rij);
                this.zetOpPositie(kolom - 1, rij, volgende === Veld.LeegDoel ? Veld.SpelerOpLeegDoel : Veld.Speler);
                this.zetOpPositie(kolom, rij, waarHetKratKomt);
                this.zetOpPositie(kolom + 1, rij, this.watZitErOpPositie(kolom + 1, rij) === Veld.KratOpDoel ? Veld.LeegDoel : Veld.Leeg);
                break;
        }

        this.stappen = this.stappen.substring(0, this.stappen.length - 1);
        this.aantalStappen = this.aantalStappen - 1;
        this.teken();
    }
}

window.customElements.define('sokoban-game', SokobanComponent);
