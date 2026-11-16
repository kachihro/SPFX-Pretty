import * as React from 'react';
import * as ReactDom from 'react-dom';
import { BaseClientSideWebPart } from '@microsoft/sp-webpart-base';
import { IReadonlyTheme } from '@microsoft/sp-component-base';
import { PrimaryButton } from 'office-ui-fabric-react';
export interface IOldNewsWebPartProps { title: string; }
export default class OldNewsWebPart extends BaseClientSideWebPart<IOldNewsWebPartProps> {
  protected onThemeChanged(t: IReadonlyTheme | undefined): void { void t; }
  public render(): void { ReactDom.render(React.createElement(PrimaryButton, { text: this.properties.title }), this.domElement); }
  protected onDispose(): void { ReactDom.unmountComponentAtNode(this.domElement); }
}
