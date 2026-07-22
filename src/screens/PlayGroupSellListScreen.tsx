import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { getPlayGroupSellList, listSellListItems } from "../api/sell-lists";
import { BackHeader } from "../components/BackHeader";
import { SellListItemRow } from "../components/SellListItemRow";
import { StatusView } from "../components/StatusView";
import { useApi } from "../hooks/useApi";

export function PlayGroupSellListScreen() {
  const { t } = useTranslation();
  const { groupId = "" } = useParams();

  const sellList = useApi(
    () => getPlayGroupSellList(groupId),
    [groupId],
  );
  const items = useApi(
    () =>
      sellList.data?.sellList
        ? listSellListItems(sellList.data.sellList.id)
        : Promise.resolve(null),
    [sellList.data?.sellList?.id],
  );

  const canEdit = sellList.data?.canEdit ?? false;

  return (
    <div className="screen">
      <BackHeader title={t("sellLists.title")} />
      <StatusView
        loading={sellList.loading}
        error={sellList.error}
        onRetry={sellList.reload}
        empty={
          sellList.data && !sellList.data.sellList
            ? t("sellLists.groupEmpty")
            : undefined
        }
      />
      {sellList.data?.sellList && (
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
              canEdit={canEdit}
              onChanged={items.reload}
            />
          ))}
        </>
      )}
    </div>
  );
}
