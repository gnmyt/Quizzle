import Logo from "@/common/assets/images/logo.png";
import "./styles.sass";

export const Loading = () => {
    return (
        <div className="loading-container">
            <img src={Logo} alt="Loading..." />
        </div>
    )
}