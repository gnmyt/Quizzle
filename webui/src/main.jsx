import React from "react";
import ReactDOM from "react-dom/client";
import {BrandingProvider} from "@/common/contexts/Branding";
import {createBrowserRouter, RouterProvider} from "react-router-dom";
import Root from "@/common/layouts/Root";
import "@fontsource/inter";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
import "@fontsource/inter/900.css";
import "@/common/styles/default.sass";
import Home from "@/pages/Home";

const router = createBrowserRouter([
    {
        path: '/',
        element: <Root/>,
        children: [
            {path: '/', element: <Home/>},
        ]
    },
]);

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <BrandingProvider>
            <RouterProvider router={router} />
        </BrandingProvider>
    </React.StrictMode>,
)
