export interface PickContactResult {
  cancelled: boolean;
  name?: string;
  givenName?: string;
  familyName?: string;
}

export interface PactaraContactPickerPlugin {
  pickContact(): Promise<PickContactResult>;
}