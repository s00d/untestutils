/** Ambient types for the unbundled Nuxt-virtual helper shipped as .mjs. */
declare module './suspended.mjs' {
  export const r: {
    cleanupAll: () => void;
    wrapperSuspended: (
      component: any,
      options: any,
      helpers: Record<string, any>,
    ) => Promise<{ wrapper: any; setProps: (props: any) => void }>;
  };
}
