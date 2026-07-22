import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { getMySellList, listSellListItems } from "../api/sell-lists";
import { SellListItemRow } from "../components/SellListItemRow";
import { LockIcon, TagIcon } from "../components/icons";
import { StatusView } from "../components/StatusView";
import { useApi } from "../hooks/useApi";
import { useAuth } from "../store/auth";

function MySellListContent() {
  const { t } = useTranslation();
  const sellList = useApi(() => getMySellList());
  const items = useApi(
    () =>
      sellList.data
        ? listSellListItems(sellList.data.id)
        : Promise.resolve(null),
    [sellList.data?.id],
  );

  return (
    <>
      <StatusView
        loading={sellList.loading}
        error={sellList.error}
        onRetry={sellList.reload}
      />
      {sellList.data === null && !sellList.loading && !sellList.error && (
        <div className="card gate">
          <div className="gate__icon">
            <TagIcon size={30} />
          </div>
          <h2 className="gate__title">{t("sellLists.emptyTitle")}</h2>
          <p className="gate__text">{t("sellLists.emptyDescription")}</p>
          <Link to="/collection" className="btn btn--grad btn--block">
            {t("sellLists.emptyCta")}
          </Link>
        </div>
      )}
      {sellList.data && (
        <>
          <StatusView
            loading={items.loading}
            error={items.error}
            onRetry={items.reload}
            empty={
              items.data && items.data.items.length === 0
                ? t("sellLists.itemsEmpty")
                : undefined
            }
          />
          {items.data?.items.map((item) => (
            <SellListItemRow
              key={item.id}
              item={item}
              canEdit
              onChanged={items.reload}
            />
          ))}
        </>
      )}
    </>
  );
}

export function MySellListScreen() {
  const { t } = useTranslation();
  const { isAuthenticated } = useAuth();

  return (
    <div className="screen">
      <div className="screen-head">
        <div className="screen-head__titles">
          <h1 className="screen-title">{t("sellLists.title")}</h1>
        </div>
      </div>
      {isAuthenticated ? (
        <MySellListContent />
      ) : (
        <div className="card gate">
          <div className="gate__icon">
            <LockIcon size={30} />
          </div>
          <h2 className="gate__title">{t("common.loginRequiredTitle")}</h2>
          <p className="gate__text">{t("sellLists.gateText")}</p>
          <Link to="/login" className="btn btn--grad btn--block">
            {t("common.signIn")}
          </Link>
        </div>
      )}
    </div>
  );
}
