const isNode = typeof window === "undefined";

const toSnakeCase = (str: string) => {
  return str.replace(/([A-Z])/g, "_$1").toLowerCase();
};

interface GetAppParamValueOptions {
  defaultValue?: string;
  removeFromUrl?: boolean;
}

const getAppParamValue = (
  paramName: string,
  {
    defaultValue = undefined,
    removeFromUrl = false,
  }: GetAppParamValueOptions = {}
) => {
  if (isNode) {
    return defaultValue;
  }
  const urlParams = new URLSearchParams(window.location.search);
  const searchParam = urlParams.get(paramName);
  if (removeFromUrl) {
    urlParams.delete(paramName);
    const newUrl = `${window.location.pathname}${
      urlParams.toString() ? `?${urlParams.toString()}` : ""
    }${window.location.hash}`;
    window.history.replaceState({}, document.title, newUrl);
  }
  if (searchParam) {
    return searchParam;
  }
  return defaultValue ?? null;
};

const getAppParams = () => {
  return {
    appId: getAppParamValue("app_id", {
      defaultValue: process.env.NEXT_PUBLIC_PROGRR_APP_ID,
    }),
    serverUrl: getAppParamValue("server_url", {
      defaultValue: process.env.NEXT_PUBLIC_PROGRR_BACKEND_URL,
    }),
    token: getAppParamValue("access_token", { removeFromUrl: true }),
    fromUrl:
      typeof window !== "undefined"
        ? getAppParamValue("from_url", { defaultValue: window.location.href })
        : null,
    functionsVersion: getAppParamValue("functions_version"),
  };
};

export const appParams = {
  ...getAppParams(),
};
