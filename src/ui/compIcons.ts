// Icon URLs keyed by apiName, one map per Set data catalog. Built once in
// App and threaded to every tile and the drawer.
export interface CompIcons {
  traits: ReadonlyMap<string, string | undefined>;
  units: ReadonlyMap<string, string | undefined>;
  items: ReadonlyMap<string, string | undefined>;
}
