import { BaseClientSideWebPart } from '@microsoft/sp-webpart-base';
export default class HelloWorldWebPart extends BaseClientSideWebPart<{}> {
  public render(): void { this.domElement.innerHTML = '<div>Hello</div>'; }
}
