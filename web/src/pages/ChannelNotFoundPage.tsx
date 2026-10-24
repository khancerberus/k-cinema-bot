import { isRouteErrorResponse, Link, useParams, useRouteError } from "react-router";

export const ChannelNotFoundPage = () => {
  const error = useRouteError();
  const { channel } = useParams();
  const notFound = isRouteErrorResponse(error) && error.status === 404;

  return (
    <div className="flex flex-col items-center justify-center flex-1 gap-4 px-4 py-10 text-center">
      <h1 className="text-8xl font-bold font-bebaskai">{notFound ? "404" : "Error"}</h1>
      <p className="text-xl text-gray-300">
        {notFound
          ? `El canal "${channel}" no está registrado en K-Cinema.`
          : "No se pudo cargar el canal. Inténtalo de nuevo más tarde."}
      </p>
      <Link to="/" className="text-[#00fff9] hover:underline">
        Volver al inicio
      </Link>
    </div>
  );
};
