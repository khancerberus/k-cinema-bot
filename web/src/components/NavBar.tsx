import { Link, useNavigate } from "react-router";
import { clearSession, getSession } from "../lib/session";
import type { ChannelProfile } from "../types/channel.type";

interface NavBarProps {
  channel: ChannelProfile;
  isOwner: boolean;
}

export const NavBar = ({ channel, isOwner }: NavBarProps) => {
  const navigate = useNavigate();
  const session = getSession();
  const base = `/${channel.channelUsername}`;

  const logout = () => {
    clearSession();
    navigate("/");
  };

  return (
    <nav className="flex flex-wrap items-center min-h-14 px-4 py-2 gap-x-6 gap-y-2">
      <h1 className="text-2xl font-bold font-bebaskai">
        <Link to={base}>K-Cinema Bot</Link>
      </h1>

      <div className="flex flex-wrap gap-4">
        <a href="#" className="text-white hover:text-[#ffa300]">
          Recomendaciones
        </a>
        <Link to={`${base}/rated-movies`} className="text-white hover:text-[#ffa300]">
          Rated Movies
        </Link>
        <Link to={`${base}/rated-games`} className="text-white hover:text-[#ffa300]">
          Rated Games
        </Link>
        {isOwner && (
          <Link to={`${base}/current-movie`} className="text-white hover:text-[#ffa300]">
            Votación
          </Link>
        )}
      </div>

      <div className="flex items-center gap-4 ml-auto text-sm">
        {session ? (
          <>
            {!isOwner && (
              <Link to={`/${session.channelUsername}`} className="text-[#00fff9] hover:underline">
                Mi perfil
              </Link>
            )}
            <button className="text-stone-400 hover:text-white cursor-pointer" onClick={logout}>
              Salir ({session.channelUsername})
            </button>
          </>
        ) : (
          <Link to="/" className="text-[#00fff9] hover:underline">
            Entrar
          </Link>
        )}
      </div>
    </nav>
  );
};
