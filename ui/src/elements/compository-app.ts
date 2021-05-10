import {
  Constructor,
  css,
  html,
  LitElement,
  property,
  query,
} from 'lit-element';
import { AppWebsocket, AdminWebsocket, CellId } from '@holochain/conductor-api';
import { Card } from 'scoped-material-components/mwc-card';
import { DnaGrapes, GrapesService } from '@compository/grapes';
import { serializeHash } from '@holochain-open-dev/core-types';
import { BaseElement } from '@holochain-open-dev/common';
import { CircularProgress } from 'scoped-material-components/mwc-circular-progress';
import { sharedStyles } from './sharedStyles';
import { router } from '../router';
import {
  ADMIN_URL,
  APP_URL,
  COMPOSITORY_DNA_HASH,
  DOCKER_DESTKOP_URL,
} from '../constants';
import {
  InstallDnaDialog,
  InstalledCells,
  ComposeZomes,
  DiscoverDnas,
  CompositoryService,
  connectService,
  PublishZome,
} from '@compository/lib';
import { TopAppBar } from 'scoped-material-components/mwc-top-app-bar';
import { Button } from 'scoped-material-components/mwc-button';
import { IconButton } from 'scoped-material-components/mwc-icon-button';

export class CompositoryApp extends BaseElement {
  @property({ type: Array })
  _selectedCellId: CellId | undefined = undefined;

  @property({ type: Array })
  _holochainPresent = false;
  @property({ type: Array })
  _loading = true;
  @query('#install-dialog')
  _installDnaDialog!: InstallDnaDialog;

  @property({ type: String })
  _nonexistingDna: string | undefined = undefined;

  @property({ type: Boolean })
  _activeView: 'home' | 'dna' | 'non-existing-dna' | 'publish-zome' = 'home';

  _appWebsocket!: AppWebsocket;
  _adminWebsocket!: AdminWebsocket;
  _compositoryCellId!: CellId;

  get _compositoryService(): CompositoryService {
    return new CompositoryService(
      this._adminWebsocket,
      this._appWebsocket,
      this._compositoryCellId
    );
  }

  async firstUpdated() {
    try {
      await this.connectToHolochain();
      this._holochainPresent = true;

      router
        .on({
          '/dna/:dna': async params => {
            const cellIds = await this._adminWebsocket.listCellIds();
            this._selectedCellId = cellIds.find(
              cellId => serializeHash(cellId[0]) === params.dna
            );

            if (!this._selectedCellId) {
              this._activeView = 'non-existing-dna';
              this._nonexistingDna = params.dna;
              this._loading = false;
            }
            this._activeView = 'dna';
          },
          '/publish-zome': () => {
            this._activeView = 'publish-zome';
          },
          '*': async () => {
            this._activeView = 'home';
            this._selectedCellId = undefined;
          },
        })
        .resolve();
    } catch (e) {
      this._holochainPresent = false;
    } finally {
      this._loading = false;
    }
  }

  async connectToHolochain() {
    this._adminWebsocket = await AdminWebsocket.connect(ADMIN_URL);
    this._appWebsocket = await AppWebsocket.connect(APP_URL, 300000);

    const cellIds = await this._adminWebsocket.listCellIds();

    this._compositoryCellId = cellIds.find(
      cellId => serializeHash(cellId[0]) === COMPOSITORY_DNA_HASH
    ) as CellId;

    if (!this._compositoryCellId) throw new Error('Compository DNA not found');

    const compositoryService = this._compositoryService;

    if (process.env.FILE_STORAGE_PROVIDER) {
      await this._appWebsocket.callZome({
        cap: null,
        cell_id: this._compositoryCellId,
        zome_name: 'file_storage',
        fn_name: 'announce_as_provider',
        payload: null,
        provenance: this._compositoryCellId[1],
      });

      console.log('announced!');
    }
    this.defineScopedElement(
      'dna-grapes',
      class extends DnaGrapes {
        get _compositoryService() {
          return compositoryService;
        }
      }
    );

    this.defineScopedElement(
      'discover-dnas',
      connectService(DiscoverDnas, compositoryService)
    );
    this.defineScopedElement(
      'install-dna-dialog',
      connectService(InstallDnaDialog, compositoryService)
    );
    this.defineScopedElement(
      'compose-zomes',
      connectService(ComposeZomes, compositoryService)
    );
    this.defineScopedElement(
      'installed-cells',
      connectService(InstalledCells, compositoryService)
    );
    this.defineScopedElement(
      'publish-zome',
      connectService(PublishZome, compositoryService)
    );
  }

  onCellInstalled(e: CustomEvent) {
    const cellId = e.detail.cellId;
    router.navigate(`/dna/${serializeHash(cellId[0])}`);
  }

  renderNonexistingDna() {
    return html`
      <div class="fill center-content">
        <mwc-card style="width: 800px;">
          <div class="column" style="margin: 16px">
            <span class="title" style="margin-bottom: 24px;">
              DNA not found
            </span>
            <span style="margin-bottom: 16px;">
              The DNA with hash "${this._nonexistingDna}" doesn't seem to exist
              in the compository.
            </span>
            <span style="margin-bottom: 16px;">
              Make sure the DNA hash in the URL is correct and try again.
            </span>

            <div class="column" style="align-items: flex-end">
              <mwc-button
                label="Go back"
                @click=${() => {
                  this._nonexistingDna = undefined;
                  router.navigate('/');
                }}
              ></mwc-button>
            </div></div
        ></mwc-card>
      </div>
    `;
  }

  renderHolochainNotPresent() {
    return html` <div class="column fill center-content">
      <mwc-card style="width: 1100px; margin-bottom: 48px;">
        <div class="column" style="margin: 16px">
          <span class="title" style="margin-bottom: 24px; font-size: 32px;"
            >Compository</span
          >
          <span style="margin-bottom: 16px"
            >Play with holochain in a new way, by generating new DNAs on the fly
            and composing UIs to suit your unique purposes.</span
          >
          <span style="margin-bottom: 16px"
            >Please note! This is an experiment, not ready to use in any kind of
            production environment. This web app and the compository DNA will
            suffer a lot of changes, so expect rapid iteration and things
            breaking.
          </span>
          <span
            >Try it out by following the instructions below! What would be awesome to add to the compository? Are
            you excited to play with this in some way? Tell us in the
            <a
              href="https://forum.holochain.org/t/introducing-the-compository/4486"
              >Holochain Forum</a
            >.</span
          >

          <hr>

          <span style="font-size: 20px; margin-top: 16px; margin-bottom: 8px;"
            >Running Without a Terminal</span
          >
          <ul>
            <li>
              First, download and install
              <a href="${DOCKER_DESTKOP_URL}">docker desktop</a>.
            </li>
            <li>
              On Windows, download and execute
              <a href="assets/compository-launch.bat">this file</a>. You can
              clean up the persistent storage executing
              <a href="assets/compository-cleanup.bat">this file</a>.
            </li>
            <li>
              On MacOs, download and extract <a href="assets/compository-commands.zip">this zip</a> and execute
             the "compository-launch.command" file</a>. You can
              clean up the persistent storage executing the "compository-cleanup.command" file.
            </li>
            <li><strong>Lastly, navigate to <a href="http://localhost:8888/">http://localhost:8888/</a> to enter the web app.</strong></li>
          </ul>

          <span style="font-size: 20px; margin-bottom: 16px; margin-top: 16px;"
            >Running Inside a Terminal</span
          >

          <span style="margin-bottom: 20px;">
            Assuming you have docker already installed, <strong>run this</strong>:
          </span>

          <pre style="margin: 4px 0;">
docker run -it --init -v compository7:/database -p 22222:22222 -p 22223:22223 -p 8888:8888 guillemcordoba/compository:0.8
          </pre>
          <span style="margin-bottom: 16px;"><strong>Lastly, navigate to <a href="http://localhost:8888/">http://localhost:8888/</a> to enter the web app.</strong></span>
          <span>
            You can clean up the persistent storage by removing the docker
            volume with these commands:
          </span>
          <pre>docker rm $(docker ps -a -f status=exited -q)</pre>
          <pre style="margin: 0;">docker volume rm --force compository7</pre>
        </div>
      </mwc-card>
    </div>`;
  }

  renderPublishZome() {
    return html`
      <mwc-top-app-bar style="flex: 1; display: flex; justify-content: center">
        <mwc-icon-button
          icon="arrow_back"
          slot="navigationIcon"
          style="--mdc-theme-primary: white;"
          @click=${() => router.navigate(`/`)}
        ></mwc-icon-button>
        <div slot="title">Publish your own zome</div>

        <div class="fill column" style="padding: 16px;">
          <publish-zome
            style="width: 700px;"
            @zome-published=${() => router.navigate('/')}
          ></publish-zome>
        </div>
      </mwc-top-app-bar>
    `;
  }

  render() {
    if (this._loading)
      return html`<div class="fill center-content">
        <mwc-circular-progress indeterminate></mwc-circular-progress>
      </div>`;
    // @ts-ignore
    if (process.env.GH_PAGES === 'true' || !this._holochainPresent)
      return this.renderHolochainNotPresent();
    if (this._activeView === 'dna')
      return html`<dna-grapes
        style="flex: 1;"
        .cellId=${this._selectedCellId}
        @navigate-back=${() => router.navigate('/')}
      ></dna-grapes>`;
    else if (this._activeView === 'non-existing-dna')
      return this.renderNonexistingDna();
    else if (this._activeView === 'publish-zome')
      return this.renderPublishZome();
    else
      return html`
        <mwc-top-app-bar style="flex: 1; display: flex;">
          <div slot="title">Compository</div>

          <mwc-button
            slot="actionItems"
            label="Publish a zome"
            style="--mdc-theme-primary: white;"
            @click=${() => router.navigate(`/publish-zome`)}
          ></mwc-button>

          <div class="fill row" style="width: 100vw; height: 100%; ">
            <div class="column fill">
              <installed-cells
                class="fill"
                @cell-selected=${(e: CustomEvent) => {
                  router.navigate(`/dna/${serializeHash(e.detail.cellId[0])}`);
                }}
                style="margin: 32px; margin-right: 0; margin-bottom: 0;"
              ></installed-cells>
              <discover-dnas
                class="fill"
                style="margin: 32px; margin-right: 0;"
                @dna-installed=${(e: CustomEvent) => {
                  router.navigate(`/dna/${serializeHash(e.detail.cellId[0])}`);

                  this._loading = false;
                }}
              ></discover-dnas>
            </div>

            <compose-zomes
              style="margin: 32px;"
              class="fill"
              @dna-installed=${(e: CustomEvent) => this.onCellInstalled(e)}
            ></compose-zomes>
          </div>
        </mwc-top-app-bar>
      `;
  }

  getScopedElements(): any {
    return {
      'mwc-circular-progress': CircularProgress,
      'mwc-top-app-bar': TopAppBar,
      'mwc-button': Button,
      'mwc-icon-button': IconButton,
      'mwc-card': Card,
    };
  }

  static get styles() {
    return [
      css`
        :host {
          display: flex;
        }
        li {
          margin-bottom: 8px;
        }
      `,
      sharedStyles,
    ];
  }
}
