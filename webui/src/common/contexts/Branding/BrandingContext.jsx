import {createContext, useEffect, useState} from "react";
import {jsonRequest} from "@/common/utils/RequestUtil.js";
import Loading from "@/pages/Loading";
export const BrandingContext = createContext({});

export const BrandingProvider = ({children}) => {
    const [branding, setBranding] = useState({});

    const updateBranding = () => {
        jsonRequest("/branding")
            .then(setBranding)
            .catch(() => setTimeout(updateBranding, 5000));
    }

    useEffect(() => {
        document.documentElement.style.setProperty("--primary-color", "#6547EE");
        setTimeout(updateBranding, 1300);
    }, []);

    useEffect(() => {
        if (!branding) return;

        document.title = branding.name || "Quizzle";

        const primaryColor = branding.color;

        if (primaryColor) {
            document.documentElement.style.setProperty("--primary-color", primaryColor);
        }

        const favicon = document.querySelector("link[rel='icon']");
        if (favicon) favicon.href = "data:image/png;base64," + branding.logo;
    }, [branding]);

    return (
        <BrandingContext.Provider value={{...branding, titleImg: "data:image/png;base64," + branding.title,
            logoImg: "data:image/png;base64," + branding.logo}}>
            {Object.keys(branding).length < 1 && <Loading />}
            {Object.keys(branding).length >= 1 && children}
        </BrandingContext.Provider>
    );
}