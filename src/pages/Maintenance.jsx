import "../styles/notFound.css";

const Maintenance = () => {
  return (
    <div className="notfound-container">
      <h1 className="notfound-title">503</h1>
      <p className="notfound-message">
        This site is currently under maintenance. Thank you for your patience{" "}
      </p>
      {/* <Link to="/" className="notfound-button">
        Go Home
      </Link> */}
    </div>
  );
};

export default Maintenance;
