declare const __APP_VERSION__: string;
declare const __APP_BUILD_TIME__: string;

declare module "*?worker&url" {
  const url: string;
  export default url;
}
declare module "*?url" {
  const url: string;
  export default url;
}
