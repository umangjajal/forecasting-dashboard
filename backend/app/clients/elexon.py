import asyncio
import logging
from typing import List, Dict, Any, Optional
import httpx
from ..config import settings

logger = logging.getLogger(__name__)


class ElexonClient:
    def __init__(self, base_url: Optional[str] = None):
        self.base_url = (base_url or settings.elexon_api_base_url).rstrip("/")
        self.timeout = settings.elexon_request_timeout_seconds
        self.max_retries = settings.elexon_max_retries
        self.backoff_factor = settings.elexon_backoff_factor
        self.headers = {
            "User-Agent": "UK-Wind-Evaluation-Portal/1.0 (Day-Ahead Renewable Evaluation)",
            "Accept": "application/json"
        }

    async def _get_with_retry(self, endpoint: str, params: Dict[str, Any]) -> List[Dict[str, Any]]:
        url = f"{self.base_url}/{endpoint.lstrip('/')}"
        
        async with httpx.AsyncClient(timeout=self.timeout, headers=self.headers) as client:
            for attempt in range(1, self.max_retries + 1):
                try:
                    logger.info(f"Querying Elexon endpoint={endpoint} params={params} attempt={attempt}/{self.max_retries}")
                    response = await client.get(url, params=params)
                    
                    if response.status_code == 200:
                        data = response.json()
                        if isinstance(data, list):
                            return data
                        elif isinstance(data, dict) and "data" in data:
                            return data["data"]
                        return []
                    
                    elif response.status_code == 429:
                        retry_after = float(response.headers.get("Retry-After", self.backoff_factor * (2 ** attempt)))
                        logger.warning(f"Rate limited (429) by Elexon. Waiting {retry_after}s before retry.")
                        await asyncio.sleep(retry_after)
                        continue
                    
                    elif response.status_code >= 500:
                        delay = self.backoff_factor * (2 ** (attempt - 1))
                        logger.warning(f"Elexon server error {response.status_code}. Retrying in {delay}s...")
                        await asyncio.sleep(delay)
                        continue
                    
                    else:
                        logger.error(f"Elexon client error: HTTP {response.status_code} - {response.text[:200]}")
                        response.raise_for_status()
                
                except (httpx.RequestError, httpx.TimeoutException) as exc:
                    if attempt == self.max_retries:
                        logger.error(f"Elexon request failed after {self.max_retries} attempts: {exc}")
                        raise
                    delay = self.backoff_factor * (2 ** (attempt - 1))
                    logger.warning(f"Connection issue: {exc}. Retrying in {delay}s...")
                    await asyncio.sleep(delay)
            
            return []

    async def fetch_fuelhh_stream(self, settlement_date_from: str, settlement_date_to: str) -> List[Dict[str, Any]]:
        """
        Fetches FUELHH half-hourly outturn stream between settlement dates.
        """
        params = {
            "settlementDateFrom": settlement_date_from,
            "settlementDateTo": settlement_date_to
        }
        raw_items = await self._get_with_retry("datasets/FUELHH/stream", params)
        return raw_items

    async def fetch_wind_actuals(self, settlement_date_from: str, settlement_date_to: str) -> List[Dict[str, Any]]:
        """
        Fetches FUELHH stream and filters strictly for fuelType == 'WIND'.
        """
        raw_items = await self.fetch_fuelhh_stream(settlement_date_from, settlement_date_to)
        wind_records = []
        for r in raw_items:
            if str(r.get("fuelType", "")).upper() == "WIND":
                # Ensure fields exist and valid
                if "startTime" in r and "generation" in r and r["generation"] is not None:
                    wind_records.append({
                        "start_time_utc": r["startTime"],
                        "settlement_date": r.get("settlementDate", ""),
                        "settlement_period": int(r.get("settlementPeriod", 0)),
                        "fuel_type": "WIND",
                        "generation_mw": float(r["generation"]),
                        "publish_time_utc": r.get("publishTime")
                    })
        return wind_records

    async def fetch_windfor_stream(self, publish_from: str, publish_to: str) -> List[Dict[str, Any]]:
        """
        Fetches WINDFOR forecast stream filtered by publishDateTime.
        """
        params = {
            "publishDateTimeFrom": publish_from,
            "publishDateTimeTo": publish_to
        }
        raw_items = await self._get_with_retry("datasets/WINDFOR/stream", params)
        forecast_records = []
        for r in raw_items:
            if "startTime" in r and "publishTime" in r and r.get("generation") is not None:
                forecast_records.append({
                    "start_time_utc": r["startTime"],
                    "publish_time_utc": r["publishTime"],
                    "generation_mw": float(r["generation"])
                })
        return forecast_records


elexon_client = ElexonClient()
