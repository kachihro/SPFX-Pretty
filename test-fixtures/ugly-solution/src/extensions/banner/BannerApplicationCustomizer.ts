import { BaseApplicationCustomizer } from '@microsoft/sp-application-base';
import { Dialog } from '@microsoft/sp-dialog';
export interface IBannerApplicationCustomizerProperties {
  testMessage: string;
}
export default class BannerApplicationCustomizer extends BaseApplicationCustomizer<IBannerApplicationCustomizerProperties> {
  public onInit(): Promise<void> {
    Dialog.alert(`Hello from Banner:\n\n${this.properties.testMessage}`).catch(() => {});
    return Promise.resolve();
  }
}
