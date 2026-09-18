/** Ambient types for the unbundled Nuxt-virtual helper shipped alongside dist/index.mjs. */
declare module './suspended.mjs' {
  export function cleanupAll(): void;
  export function patchWrapperSetProps(wrapper: any, setProps: (props: any) => void): void;
  export function wrapperSuspended(
    component: any,
    options: any,
    helpers: {
      wrapperFn: (...args: any[]) => any;
      wrappedRender?: (render: any) => any;
      suspendedHelperName: string;
      clonedComponentName: string;
    },
  ): Promise<{ wrapper: any; setProps: (props: any) => void }>;
}
