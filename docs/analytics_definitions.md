# Analytics Definitions & Mathematical Formulations

## 1. Daily Return ($R_t$)
Percentage price movement between two consecutive trading days:
$$R_t = \left(\frac{P_t}{P_{t-1}} - 1\right) \times 100$$
where $P_t$ is the closing price on day $t$ and $P_{t-1}$ is the closing price on day $t-1$.

## 2. Moving Averages (SMA)
Simple Moving Averages calculated over window $N$ ($N \in \{20, 50, 200\}$):
$$\text{SMA}_N(t) = \frac{1}{N} \sum_{i=0}^{N-1} P_{t-i}$$

## 3. Monthly Return & Seasonality
For a calendar month $m$ in year $y$:
$$R_{y, m} = \left(\frac{P_{\text{last}}}{P_{\text{first}}} - 1\right) \times 100$$
where $P_{\text{first}}$ is the closing price on the first trading session of month $m$, and $P_{\text{last}}$ is the closing price on the last trading session of month $m$.

### Average Monthly Seasonality:
$$\bar{R}_m = \frac{1}{Y_m} \sum_{y=1}^{Y_m} R_{y, m}$$
where $Y_m$ is the count of available years for calendar month $m$.

### Positive-Month Frequency (Win Rate):
$$\text{WinRate}_m = \frac{\sum_{y=1}^{Y_m} \mathbb{I}(R_{y, m} > 0)}{Y_m} \times 100$$

## 4. Annualized Volatility ($\sigma_{\text{ann}}$)
Measured as the sample standard deviation of daily percentage returns scaled by $\sqrt{252}$ trading sessions:
$$\sigma_{\text{ann}} = \text{std}(R) \times \sqrt{252}$$

## 5. Drawdown & Maximum Drawdown (MDD)
The peak-to-trough decline at day $t$:
$$\text{Peak}_t = \max_{i \le t} P_i$$
$$\text{Drawdown}_t = \left(\frac{P_t - \text{Peak}_t}{\text{Peak}_t}\right) \times 100$$
$$\text{MDD} = \min_{t} \text{Drawdown}_t$$

## 6. Multi-Stock Rebased Performance
To compare securities with different absolute price scales over a common period:
$$P_{t, \text{norm}} = \left(\frac{P_t}{P_0}\right) \times 100$$
where $P_0$ is the closing price on the earliest mutually available trading date in the selected window.
