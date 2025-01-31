while read line; do
brave-browser -new-tab "$line" & 2>/dev/null
sleep 5
done < a.txt
