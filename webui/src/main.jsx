import React from "react";
import ReactDOM from "react-dom/client";
import {BrandingProvider} from "@/common/contexts/Branding";
import {createBrowserRouter, RouterProvider} from "react-router-dom";
import Root from "@/common/layouts/Root";
import "@fontsource/inter";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
import "@fontsource/inter/900.css";
import "@/common/styles/default.sass";
import Home from "@/pages/Home";
import QuizCreator from "@/pages/QuizCreator";
import Host from "@/pages/Host";
import QuizLoader from "@/pages/QuizLoader";
import {QuizProvider} from "@/common/contexts/Quiz/index.js";

const router = createBrowserRouter([
    {
        path: '/',
        element: <Root/>,
        children: [
            {path: '/', element: <Home/>},
            {path: '/create', element: <QuizCreator />},
            {path: '/load', element: <QuizLoader />},
            {path: '/host', element: <Host />}
        ]
    },
]);

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <BrandingProvider>
            <QuizProvider>
                <RouterProvider router={router} />
            </QuizProvider>
        </BrandingProvider>
    </React.StrictMode>,
)
